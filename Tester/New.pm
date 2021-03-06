package Tester::New;
use warnings;
use strict;

use Tester::Diff;

use JSON;
use LWP;
use LWP::UserAgent;
use LWP::ConnCache;
use File::Spec;
use Test::More;
use Data::Dumper::Concise;
use Exporter::Easy ( EXPORT => [ qw(done_testing
                                    hooks_sync_values
                                    init request
                                    ok
                                    send_test test) ] );

use Carp;
$SIG{__DIE__} = sub { Carp::confess @_ };

my $context;

sub message {
    print {$context->{msg_file}} @_;
    for (@_) {
        while (/\n/g) { ++$context->{msg_file_curr_line} }
    }
}
sub write_log { print {$context->{log_file}} @_ }

sub init {
    return if defined $context;
    $context->{url} = $ENV{gameurl} ? $ENV{gameurl} :
                                      "http://localhost:5000/engine";

    my $testname = $0 =~ /^(.*)\..*$/ ? $1 : 'test';
    $context->{log_file_name} = $testname . '.log';
    $context->{msg_file_name} = $testname . '.msg';
    open $context->{log_file}, '>', $context->{log_file_name};
    open $context->{msg_file}, '>', $context->{msg_file_name};
    $context->{msg_file_curr_line} = 0;
    $context->{ua} = LWP::UserAgent->new(agent => "web-game-tester");
    $context->{ua}->conn_cache(LWP::ConnCache->new());
    $context->{server_died_cnt} = 0;
}

sub request {
    my ($content) = @_;
    my $req = HTTP::Request->new(POST => $context->{url});
    $req->content($content);
    my $res = $context->{ua}->request($req);
    write_log( "\n---REQUEST---\n", $req->content() );
    write_log( "\n---RESPONSE---\n", $res->content(), "\n" );
    $res
}

sub _panic_server_crash {
    my ($c, $error) = @_;
    my $cnt = ++$context->{server_died_cnt};
    open my $f, '>', "error_$cnt.htm";
    print $f $error;
    close $f;
    print STDERR "\n ~~~ server died  >(O_o)<  ~~~ \n"
}

sub _safe_request {
    my ($c) = @_;
    my $resp = request($c->{in_json});
    if ($resp->code() != 200) {
        _panic_server_crash($c, $resp->message());
        return { res => 0,  quick => 'http status != 200; ',
                 long => 'server returned: ' . $resp->message() };
    }
    my $resp_msg = eval { from_json($resp->content()) };
    if (!$@) {
        $c->{resp} = $resp_msg;
        return undef;
    }
    _panic_server_crash($c, $resp->content());
    { res => 0, quick => 'bad json in responce',
      long => 'server returned: ' . $resp->content() }
}

sub send_test {
    my ($in, $out, $params) = @_;
    $params ||= {};
    my $c = {};
    ($c->{in}, $c->{out}, $c->{params}) = ($in, $out, $params);

    if (defined $params->{hooks}{before_req}) {
        $params->{hooks}{before_req}->($c);
    }

    $c->{in_json} = ref($in) ? eval { to_json($in) } : $in;
    $c->{out} = ref($out) ? $out : from_json($out);
    if ($@) {
        return { res => 0, quick => 'bad json in test INPUT or OUTPUT',
                 long => $@ }
    };

    my $res = _safe_request($c);
    return $res unless defined $c->{resp};

    return $out->($c) if ref($out) eq 'CODE';

    if (defined $params->{hooks}{after_resp}) {
        $params->{hooks}{after_resp}->($c);
    }

    my $diff = Tester::Diff::compare($c->{out}, $c->{resp},
                                     $params->{diff_method});

    my $err = $diff->errors_report();

    unless ($err) {
        return { res => 1, quick => 'ok', long => 'ok' }
    } else {
        my $msg = sprintf("expected:%s\nget:%s\n",
                          map { Dumper $_ } $c->{out}, $c->{resp});
        return { res => 0, quick => 'diff failed', long => $msg . $err }
    }
}

sub test {
    my $test_name = shift;
    init() unless defined $context;
    write_log("---$test_name---");
    my $res = send_test(@_);
    message(sprintf("%s: %s\n", $test_name, $res->{quick}));
    my $msg_file_line = $context->{msg_file_curr_line};
    if (defined $res->{long} && !$res->{res}) {
        message(sprintf("%s\n\n", $res->{long}))
    } else {
        message("\n")
    }

    my $t = Test::More->builder->new();
    $t->ok($res->{res}, $test_name);
    unless ($res->{res}) {
        my $fh = $t->failure_output();
        printf $fh "#   at %s line %d.\n",
            $context->{msg_file_name},
            $msg_file_line
    }
}

sub hooks_sync_values {
    my $values = \@_;
    my $from_a_to_b = sub {
        my ($a, $b, $force) = @_;
        for (@$values) {
            if ((exists $b->{$_} || $force) &&
                !defined $b->{$_} && defined $a->{$_})
            {
                $b->{$_} = $a->{$_}
            }
        }
    };
    my $hook_in = sub {
        my ($c) = @_;
        $from_a_to_b->($c->{params}{data}, $c->{in})
    };
    my $hook_out = sub {
        my ($c) = @_;
        $from_a_to_b->($c->{resp}, $c->{params}{data}, 1);
        $from_a_to_b->($c->{params}{data}, $c->{out})
    };
    { hooks => { before_req => $hook_in,
                 after_resp => $hook_out },
      data => {} }
}

1

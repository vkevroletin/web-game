package Game::Model::Game;
use Moose;
use v5.10;

use Game::Constants qw(races_with_debug powers_with_debug);
use Game::Environment qw(assert compability db_search_one
                         early_response_json
                         global_user
                         inc_counter
                         if_debug);
use Game::Model::Map;
use Game::Model::User;
use KiokuDB::Set;
use Moose::Util::TypeConstraints;
use KiokuDB::Util q(weak_set);
use List::Util q(shuffle);
use Data::Dumper;

our @db_index = qw(gameName gameId);


# TODO: use full type names since types are global objects
subtype 'GameName',
    as 'Str',
    where {
        0 < length($_) && length($_) <= 50
    },
    message {
        early_response_json({result => 'badGameName'})
    };

subtype 'playersNum',
    as 'Int',
    where {
        0 < $_ && $_ <= 5
    },
    message {
        early_response_json({result => 'badnumberOfPlayers'})
    };

subtype 'Game::Model::Game::GameDescr',
    as 'Maybe[Str]',
    where { !defined $_ || length($_) <= 300 },
    message { assert(0, 'badGameDescription') };

subtype 'Game::Model::Game::Ai',
    as 'Int',
    where {  !defined $_ || $_ <= 4 },
    message { assert(0, 'badAi' ) };


has 'gameName' => ( isa => 'GameName',
                    is => 'ro',
                    required => 1 );

has 'map' => ( isa => 'Game::Model::Map',
               is => 'rw',
               required => 0 );

has 'gameDescr' => ( isa => 'Game::Model::Game::GameDescr',
                     is => 'rw',
                     default => '' );

has 'players' => ( isa => 'ArrayRef[Game::Model::User]',
                   is => 'rw',
                   default => sub { [] } );

has 'activePlayerNum' => ( isa => 'Int',
                           is => 'rw',
                           default => 0 );

has 'gameId' => ( isa => 'Int',
                  is => 'ro',
                  required => 0 );

has 'state' => ( isa => 'Str',
                 is => 'rw',
                 default => 'notStarted' );

has 'racesPack' => ( isa => 'ArrayRef[Str]',
                     is => 'rw',
                     default => sub { [] } );

# FIXME: construct token badges with game #############
has 'powersPack' => ( isa => 'ArrayRef[Str]',
                      is => 'rw',
                      default => sub { [] } );

has 'bonusMoney' => ( isa => 'ArrayRef[Int]',
                      is => 'rw',
                      default => sub { [(0) x 6] } );

has 'tokenBadgeIds' => ( isa => 'ArrayRef[Int]',
                         is => 'rw',
                         default => sub { [1 .. 6] } );
#######################################################

has 'lasTokenBadgeId' => ( isa => 'Int',
                           is => 'rw',
                           default => 6 );

has 'history' => ( isa => 'ArrayRef',
                   is => 'rw',
                   default => sub { [] } );

has 'raceStateStorage' => ( isa => 'HashRef',
                            is => 'rw',
                            default => sub { {} } );

has 'ai' => ( isa => 'Game::Model::Game::Ai',
              is => 'rw',
              default => 0 );

has 'aiJoined' => ( isa => 'Int',
                    is => 'rw',
                    default => 0 );

# TODO: process game turn during gameplay
has 'turn' => ( isa => 'Int',
                is => 'rw',
                default => 0 );


has 'lastDiceValue' => ( isa => 'Maybe[Int]',
                         is => 'rw',
                         required => 0 );


sub BUILD {
    my ($self) = @_;
    $self->{gameId} = inc_counter('Game::Model::Game::gameId');
    assert($self->ai() <= $self->map()->playersNum, 'badAiNum');
}

before 'state' => sub {
    my ($self, $new_state) = @_;
    if (defined $new_state &&
        $self->state() eq 'notStarted' &&
        $new_state ne 'notStarted' &&
        !@{$self->racesPack()})
    {
        $self->_create_tokens_pack()
    }
};

sub activePlayer {
    my ($self) = @_;
    $self->players()->[$self->activePlayerNum()]
}

sub add_player {
    my ($self, $user) = @_;
    push @{$self->players()}, $user
}

sub add_to_attack_history {
    my ($self, $reg) = @_;
    my $h = { whom => $reg->owner(),
              tokensNum => $reg->tokensNum(),
              region => $reg };
    push @{$self->history()}, $h;
}

sub _create_tokens_pack {
    my ($self) = @_;
    $self->racesPack([shuffle @Game::Constants::races]);
    $self->powersPack([shuffle @Game::Constants::powers]);
}

sub _extract_last_attack {
    my ($self) = @_;
    my $la = $self->lastAttack();
    return undef unless $la;
    { #whom => $self->number_of_user($la->{whom}),
      whom => $la->{whom} ? $la->{whom}->id() : undef,
      tokensNum => $la->{tokensNum},
      reg => $self->number_of_region($la->{region}) }
}

sub _extract_visible_tokens {
    my ($self) = @_;
    my @res;
    for my $i (0 .. 5) {
        my $tok = {};
        $tok->{tokenBadgeId} = $self->tokenBadgeIds()->[$i];
        $tok->{raceName} = ucfirst($self->racesPack()->[$i]);
        $tok->{specialPowerName} = ucfirst($self->powersPack()->[$i]);
        $tok->{position} = $i;
        $tok->{bonusMoney} = $self->bonusMoney()->[$i];
        push @res, $tok
    }
    \@res
}

sub _copy_races_state_storage {
    my ($self, $state) = @_;
    for (keys %{$self->raceStateStorage()}) {
        $state->{$_} = $self->raceStateStorage()->{$_}
    }
}

sub _extract_history {
    my ($self) = @_;
    my $h = sub {
        my $r = $_[0];
        $r->{whom} = $r->{whom}->id() if ($r->{whom} );
        $r->{region} = $self->number_of_region($r->{region});
        $r
    };
    my @res = map { $h->($_) } @{$self->history()};
    \@res
}

sub extract_state {
    my ($self) = @_;
    my $res = {};
    $res->{activePlayerNum} = $self->activePlayerNum();
    $res->{lastAttack} = $self->_extract_last_attack();
    $res->{state} = $self->state();
    my @players_st;
    push @players_st, $_->extract_state() for @{$self->players()};
    $res->{players} = \@players_st;
    my @regions;
    push @regions, $_->extract_state() for @{$self->map()->regions()};
    $res->{regions} = \@regions;
    $res->{visibleTokenBadges} = $self->_extract_visible_tokens();
    $res->{attacksHistory} = $self->_extract_history();
    $res->{mapId} = $self->map()->id();
    $res->{turn} = $self->turn();
    $self->_copy_races_state_storage($res);
    $res
}

sub short_info {
    my ($s) = @_;
    my $res = {
        gameId => $s->gameId(),
        gameName => $s->gameName(),
        gameDescr => $s->gameDescr(),
        playersNum => scalar @{$s->players()},
        maxPlayersNum => $s->map()->playersNum(),
        activePlayerId => $s->activePlayer()->id(),
        turn => $s->turn(),
        turnsNum => $s->map()->turnsNum(),
        mapId => $s->map()->id(),
        mapName => $s->map()->mapName(),
        aiRequiredNum => $s->ai() - $s->aiJoined(),
        ai => $s->ai()
    };
}

sub full_info {
    my ($s) = @_;
    my $state = $s->extract_state();
    my $s_i = $s->short_info();
    for my $k (keys %{$s_i}) {
        $state->{$k} = $s_i->{$k}
    }
    for my $i (0 .. $#{$s->players()}) {
        $state->{players}->[$i]->{name} =
            $s->players()->[$i]->{username}
    }
    $state
}

sub remove_player {
    my ($self, $user) = @_;
    my $nu = [ grep { $_ ne $user } @{$self->players()} ];
    $self->players($nu);
}

sub lastAttack {
    my $self = shift;
    return undef unless @{$self->history()};
    $self->{history}->[-1]
}

sub _load_players_from_state {
    my ($self, $data) = @_;
    assert(ref($data->{players}) eq 'ARRAY', 'badPlayers');
    my $load_user = sub {
        my ($id) = @_;
        my $p = db_search_one({ CLASS => 'Game::Model::User' },
                              { id => $id });
        assert($p, 'badUserId', userId => $id);
        assert(!$p->activeGame(), 'alreadyInGame', userId => $id);
        $p->activeGame($self);
        $p->load_state($_);
        $p
    };
    my @res = map { $load_user->($_->{id}) } @{$data->{players}};
    $self->players(\@res);
}

sub _load_token_badges_from_state {
    my ($self, $data) = @_;
    assert(ref($data->{visibleTokenBadges}) eq 'ARRAY',
           'badVisibleTokenBadges', descr => 'notArrayRef');
    my (@race_p, @pow_p, @mon);

    for (@{$data->{visibleTokenBadges}}) {
        assert(ref($_) eq 'HASH', 'badVisibleTokenBadges',
               notHash => $_);
        my ($race, $power) = ($_->{raceName},
                              $_->{specialPowerName});

        assert(defined $race &&
               ($race ~~ races_with_debug()),
               'badRace', race => $race);
        assert(defined $power &&
               ($power ~~ powers_with_debug()),
               'badPower', power => $power);
        assert(defined $_->{bonusMoney} &&
               $_->{bonusMoney} =~ /^\d+$/, 'badBonusMoney');
        push @race_p, $race;
        push @pow_p, $power;
        push @mon, $_->{bonusMoney};
    }
    $self->racesPack(\@race_p);
    $self->powersPack(\@pow_p);
    $self->bonusMoney(\@mon);
}

# should be loaded: $self->players
sub _load_regions_from_state {
    my ($self, $data) = @_;
    assert(ref($data->{regions}) eq 'ARRAY', 'badRegions',
           descr => 'notHash');
    assert(@{$data->{regions}} == @{$self->map()->regions()},
           'badRegionsNum');
    my $i = 0;
    my @pl_id = map { $_->id() } @{$self->players()};
    for (@{$data->{regions}}) {
        assert(!defined $_->{owner} || $_->{owner} ~~ @pl_id,
               'badRegions', 'badOwner' => $_->{owner},
               'gamePlayers' => [@pl_id]);
        $self->map()->get_region($i++)->load_state($_);
    }
}

# should be loaded: $self->map
#                   $self->players
sub _load_attacks_history_from_state {
    my ($self, $data) = @_;
    my $err = 'badAttacksHistory';
    my $h = $data->{attacksHistory};
    assert(ref($h) eq 'ARRAY', $err, descr => 'notArray');
    my @res;
    for my $hist_item (@{$h}) {
        assert(ref($hist_item) eq 'HASH', $err,
               notHash => $hist_item);
        my $num = sub { defined $_[0] && $_[0] =~ /^\d+$/ };
        my $r = $hist_item->{region};

        assert( $num->($r) &&
                0 <= $r && $r <= @{$self->map()->regions()},
                $err, badRegion => $r );
        assert( $num->($hist_item->{tokensNum}), $err,
                badTokensNum => $hist_item->{tokensNum} );
        my $is_who = sub {
            my ($player) = @_;
            assert(defined $data->{whom}, $err,
                   badWhom => $hist_item->{whom});
            $player->id() eq $hist_item->{whom}

        };
        my $p = $data->{whom};
        if (defined $data->{whom}) {
            ($p) = grep { $is_who->($_) } @{$self->players()};
            assert($p, $err, badDefender => $data->{whom});
        }
        push @res, {
          region => $self->map()->get_region($r),
          tokensNum => $hist_item->{tokensNum},
          whom => $p ? $p->id() : undef
        }
    }

    $self->history(\@res)
}

sub load_state {
    my ($self, $data) = @_;

    die 'bad map id' if $data->{mapId} ne $self->map()->id();

    my @st = qw(conquer redeployed defend declined);
    assert(($data->{state} ~~ @st), 'badState');
    $self->state($data->{state});

    $self->_load_players_from_state($data);
    $self->_load_regions_from_state($data);
    $self->_load_token_badges_from_state($data);
    $self->_load_attacks_history_from_state($data);

    assert(defined $data->{activePlayerNum} &&
           $data->{activePlayerNum} =~ /^\d+$/,
           'badActivePlayerNum');
    $self->activePlayerNum($data->{activePlayerNum});
}

sub next_player {
    my ($self) = @_;
    my $n = $self->activePlayerNum() + 1;
    if ($n >= @{$self->players()}) {
        $n = 0;
        $self->turn($self->turn() + 1);
    }
    $self->history([]);
    $self->activePlayerNum($n);
    $self->lastDiceValue(undef);
}

sub number_of_user {
    my ($self, $user) = @_;
    return undef unless $user;
    my $i = 0;
    for (@{$self->players()}) {
        return $i if $_ eq $user;
        ++$i
    }
    undef
}

sub number_of_region {
    my ($self, $region) = @_;
    return undef unless $region;
    my $i = 1;
    for (@{$self->map()->regions()}) {
        return $i if $_ eq $region;
        ++$i
    }
    undef
}

sub ready {
    my ($self) = @_;
    return 0 unless @{$self->players()} > 1;
    return 0 if $self->ai() != $self->aiJoined();
    for my $user (@{$self->players()}) {
        return 0 unless $user->readinessStatus()
    }
    1
}

sub pick_tokens {
    my ($self, $race_num) = @_;
    my $race = splice @{$self->racesPack()}, $race_num, 1;
    my $power = splice @{$self->powersPack()}, $race_num, 1;
    my $coins = splice @{$self->bonusMoney()}, $race_num, 1;
    my $id =  splice @{$self->tokenBadgeIds()}, $race_num, 1;
    push @{$self->bonusMoney()}, 0;
    push @{$self->tokenBadgeIds()}, ++$self->{lasTokenBadgeId};
    ($race, $power, $id, $coins)
}

sub put_back_tokens {
    my ($self, $race) = @_;
    push @{$self->racesPack()}, $race->race_name();
    push @{$self->powersPack()}, $race->power_name();
}

sub random_dice { int rand(4) }


1

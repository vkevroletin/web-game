package Game::Race::Elves;
use Moose;

use Game::Environment qw(early_response_json global_user global_game);

extends( 'Game::Race' );
with( 'Game::Roles::Race' );


sub race_name { 'elves' }

sub tokens_cnt { 6 }

override 'clear_reg_and_die' => sub {
    my ($self, $reg) = @_;
    return super() if $self->inDecline();
    my $tok_cnt = $reg->owner()->tokensInHand() + $reg->tokensNum();
    $reg->owner()->tokensInHand($tok_cnt);
};


1

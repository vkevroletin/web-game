package Game::Race::Ratmen;
use Moose;

use Game::Environment qw(early_response_json global_user global_game);

extends( 'Game::Race' );
with( 'Game::Roles::Race' );


sub race_name { 'ratmen' }

sub tokens_cnt { 8 }


1

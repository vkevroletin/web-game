package Game::Power::Seafaring;
use Moose::Role;

use Game::Environment qw(:std :db :response);

with( 'Game::Roles::Power' );


sub power_name { 'seafaring' }

sub _power_tokens_cnt { 5 }

override '_check_land_type' => sub { 1 };


1

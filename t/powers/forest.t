use strict;
use warnings;

use lib '..';
use Tester::State;
use Tester::New;

my ($user1, $user2) = Tester::State::square_map_two_users(
   ['border', 'forest'], ['border', 'forest'],   ['border', 'hill'], ['border', 'hill']
);

test('select power',
    {
      action => "selectGivenRace",
      power => "forest",
      race => "debug",
      sid => undef
    },
    {
      result => "ok"
    },
    $user1 );

actions->check_tokens_cnt(4, $user1);

test('conquer',
    {
      action => "conquer",
      regionId => 1,
      sid => undef
    },
    {
      result => "ok"
    },
    $user1 );

test('conquer',
    {
      action => "conquer",
      regionId => 3,
      sid => undef
    },
    {
      result => "ok"
    },
    $user1 );

test('redeploy',
    {
      action => "redeploy",
      regions => [
        {
          regionId => 1,
          tokensNum => 1
        },
        {
          regionId => 3,
          tokensNum => 1
        }
      ],
      sid => undef
    },
    {
      result => "ok"
    },
    $user1 );

test('finish turn',
    {
      action => "finishTurn",
      sid => undef
    },
    {
      coins => 3,
      result => "ok"
    },
    $user1 );

test('select race 2nd user',
    {
      action => "selectGivenRace",
      power => "forest",
      race => "debug",
      sid => undef
    },
    {
      result => "ok"
    },
    $user2 );

test('conquer',
    {
      action => "conquer",
      regionId => 4,
      sid => undef
    },
    {
      result => "ok"
    },
    $user2 );

test('redeploy',
    {
      action => "redeploy",
      regions => [
        {
          regionId => 4,
          tokensNum => 1
        }
      ],
      sid => undef
    },
    {
      result => "ok"
    },
    $user2 );

test('finish turn',
    {
      action => "finishTurn",
      sid => undef
    },
    {
      coins => 1,
      result => "ok"
    },
    $user2 );

test('decline 1st',
    {
      action => "decline",
      sid => undef
    },
    {
      result => "ok"
    },
    $user1 );

test('finish turn',
    {
      action => "finishTurn",
      sid => undef
    },
    {
      coins => 2,
      result => "ok"
    },
    $user1 );

test('decline 2nd',
    {
      action => "decline",
      sid => undef
    },
    {
      result => "ok"
    },
    $user2 );

test('finish turn',
    {
      action => "finishTurn",
      sid => undef
    },
    {
      coins => 1,
      result => "ok"
    },
    $user2 );

done_testing();

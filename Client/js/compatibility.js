
function compatibility_mapper_type() {}
var CompMapper = compatibility_mapper_type.prototype;
var compatibility_mapper = new compatibility_mapper_type;

CompMapper.fix_game_state = function(gs) {
  CompMapper._fix_players_in_place(gs);
  CompMapper._fix_map_in_place(gs);
  CompMapper._fix_state_field_in_place(gs);

  for (var i in gs.players) {
    if (gs.players[i].id == gs.activePlayerId) {
      gs.activePlayerNum = i;
    }
  }

  gs.turn = gs.currentTurn;

};

/*

---result---

{
  "lastEvent" : 1,
  "stage" : "selectRace",
  "state" : 1,
}

{
  "activePlayerNum" : 0,          -> "currentPlayersNum"
  "turn" : 0,                     -> "currentTurn"

--- only for game info (Oh, yepp... )
  "mapId" : 1,                    -> ? {map}
  "mapName" : "Are you lucky?",   -> ? {map}
  "maxPlayersNum" : 2,            -> ? {map}
  "turnsNum" : 5,                 -> ? {map}
---

  "regions" : ---,                -> "map" +

  "raceSelected" : false,         -> ? {wtf} may be should be definedl by "lastEvent" ???
  "state" : "notStarted",         -> ? {wft}

  "attacksHistory" : []           -> ?
  "features" : {},                -> -
  "playersNum" : 1,               -> ? (is it really needed)
}

--their---
{
  "activePlayerId" : 1,
  "aiRequiredNum" : 1,
  "berserkDice" : null,
  "currentPlayersNum" : 1
  "currentTurn" : 0,
  "declineRequested" : false,
  "dragonAttacked" : false,
  "enchanted" : false,
  "friendInfo" : null,
  "gameDescr" : "game1 descr",
  "gameDescription" : "game1 descr",
  "gameId" : 1,
  "gameName" : "game1",
  "gotWealthy" : false,
  "holesPlaced" : 0,
  "lastEvent" : 1,
  "map" : ---,
  "players" : ---,
  "stage" : "selectRace",
  "state" : 1,
  "visibleTokenBadges" : ---,
}
---our---
{
  "activePlayerId" : 1,
  "activePlayerNum" : 0,
  "aiRequiredNum" : 1,
  "attacksHistory" : []
  "berserkDice" : null,
  "declineRequested" : false,
  "dragonAttacked" : false,
  "enchanted" : false,
  "features" : {},
  "friendInfo" : null,
  "gameDescr" : "game1 descr",
  "gameId" : 1,
  "gameName" : "game1",
  "gotWealthy" : false,
  "holesPlaced" : 0,
  "mapId" : 1,
  "mapName" : "Are you lucky?",
  "maxPlayersNum" : 2,
  "players" : ---,
  "playersNum" : 1,
  "raceSelected" : false,
  "regions" : ---,
  "state" : "notStarted",
  "turn" : 0,
  "turnsNum" : 5,
  "visibleTokenBadges" : ---,
}

*/

CompMapper._fix_map_in_place = function(gs) {
  gs.mapId = gs.map.mapId;
  gs.mapName = gs.map.mapName;
  gs.maxPlayersNum = gs.map.playersNum;
  gs.turnsNum = gs.map.turnsNum;

  gs.map.regions.forEach(CompMapper._fix_region_in_place);
  gs.regions = gs.map.regions;
};

CompMapper._fix_region_in_place = function(reg) {
  reg.inDecline = reg.currentRegionState.inDecline;
  reg.owner = reg.currentRegionState.ownerId;
  reg.extraItems = reg.currentRegionState;
  reg.tokensNum = reg.currentRegionState.tokensNum;
};

/*

  {
  "inDecline" : false,
  "owner" : null,
  "extraItems" : {},
  "tokensNum" : 0
  }

*/

CompMapper._fix_players_in_place = function(st) {
  st.players.forEach(function(player) {
    player.name = player.username;
    player.id   = player.userId;
    player.readinessStatus = player.isReady;
  });
};

/*

---their---
{
  "priority" : 1,
  "declinedTokenBadge" : null,
  "userId" : 1,
  "tokensInHand" : 0,
  "inGame" : true,
  "coins" : 5,
  "username" : "user1",
  "isReady" : false,
  "currentTokenBadge" : null
}
---our---
{
  "name" : "user1", //only in gameInfo
  "id" : 1,
  "tokensInHand" : 0,
  "readinessStatus" : 0,
  "coins" : 5
}

*/

CompMapper.state_to_int = {
  wait    : 1,
  begin   : 0,
  in_game : 2,
  finish  : 3,
  empty   : 4
};

CompMapper.int_to_state = {
  1 : 'wait',
  0 : 'begin',
  2 : 'in_game',
  3 : 'finish',
  4 : 'empty'
};

CompMapper._fix_state_field_in_place = function(game_state) {
  var res = CompMapper.get_game_state_fields(game_state.stage,
                                             game_state.state);
  ['state', 'raceSelected', 'attacksHistory'].forEach(function(k) {
    game_state[k] = res[k];
  });
};

CompMapper.get_game_state_fields = function(stage, state_int) {
  var state = CompMapper.int_to_state[state_int];
  var result = { attacksHistory: [] };

  if (log_config.convertions) {
    log.d.info('state: ' + state);
    log.d.info('stage: ' + stage);
  }

  if (state == 'wait') {
    result.state = 'notStarted';
  } else if (state == 'finish' || state == 'empty') {
    result.state = 'finished';
  } else if (stage == 'beforeFinishTurn') {
    result.state = 'redeployed';
  } else if (stage == 'finishTurn') {
    result.state = 'declined';
  } else if (stage == 'gameOver') {
    result.state = 'finished'
  } else if (stage == 'selectRace') {
    result.state = 'conquer';
    result.raceSelected = false;
    result.attacksHistory = [];
  } else if (stage == 'beforeConquest') {
    result.state = 'conquer';
    result.raceSelected = true;
    result.attacksHistory = [];
  } else if (stage == 'conquest' ) {
    result.state = 'conquer';
    result.raceSelected = true;
    result.attacksHistory = [{}]; // works since
    // only size of attacksHistory is used in client
  } else {
    result.state = state;
  }

  if (log_config.convertions) {
    log.d.info('state: ' + result.state);
    log.d.info('raceSelected: ' + result.raceSelected);
    log.d.info('attacksHistory: ' + result.attacksHistory);
  }

  return result;
};
/*** Available game states ***
  notStarted
  conquer
  redeploy
  redeployed
  defend
  declined
  finished
*/

CompMapper.fix_game_list = function(games_list) {
  games_list.forEach(function(game) {
    var res = CompMapper.get_game_state_fields(null, game.state);
    game.state = res.state;
  });
};

var features = {
  getUserInfo: 0,
  getMapInfo: 1,
  getGameInfo: 0
};

var config = {

  force_game_state_convertion: 1,

  autologin: 1,
  livereload: 1,
  servert_push_interval: 2000,
//  predefined_user: { sid: 1, gameId: 1 }
//  predefined_user: { sid: 3 }

  server_url = "http://localhost:5000/engine";
//server_url: "http://server.lena/small_worlds"
};

var log_config = {
  console: {
    error: 1,
    warn : 1,
    info : 1,
    dump : 1
  },
  trace: 0,
  events: 0,
  modes: 0,
  requests: 0,
  convertions: 1
};

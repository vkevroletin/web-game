
var curr_modes = {major: null, minor: []};

var major_modes = {

  change: function(new_m, params) {
    log.d.info("|new major mode| -> " + new_m);
    log.d.dump(params, 'params');

    /* TODO: raise error if we want to go into major mode which
       can not be used with active minor mode or
       disable needed minor modes */
    var menu = document.getElementById("menu");
    var content = document.getElementById("content");

    if (!is_null(curr_modes.major) &&
        !is_null(this.storage[curr_modes.major].uninit)) {
      this.storage[curr_modes.major].uninit();
    }
    this.storage[new_m].init(content, params);
    curr_modes.major = new_m;

    ui.create_menu();
    log.ui.modes(curr_modes);
  },
  
  available_modes: function() {
    var res = [];
    for (var i in this.storage) {
      var m = this.storage[i];
      if (!(is_null(m.in_menu) || !m.in_menu) &&
           _check_if_mod_available(m))
      {
        res.push({name: i, obj: this.storage[i]});
      }
    }  
    return res;
  },

  get: function(mod_name) { 
    return this.storage[mod_name]; 
  },

  storage: {

    login: {
      descr: 'Login',
      in_menu: true,
      init: function(content) {
        d3.select(content).text('').node().
          appendChild(ui_forms.login.gen_form());
      },
      uninit: function() {
      }
    },

    logout: {
      descr: 'Logout',
      available_if: {
        minor_m: ['logined'],
      },
      init: function(content) {
        var q = { action: "logout",
                  sid: game.sid };

        net.send(q, function() { 
          state.delete('sid');
          events.exec('logout.success') });
      },
      uninit: function() {

      },
      in_menu: true,
    },

    register: {
      descr: 'Register',
      in_menu: true,
      init: function(content) {
        d3.select(content).text('').node().
          appendChild(ui_forms.register.gen_form());
      },
      uninit: function() {
      }
    },

    games_list: {
      descr: 'Games list',
      in_menu: true,
      init: function(content) {
        var h = function(resp) {
          d3.select(content).text('').node()
            .appendChild(ui_forms.game_list.gen_form(resp.games));
        };
        net.send({action: 'getGameList'}, h );
      }
    },

    games_new: {
      descr: 'New game',
      in_menu: true,
      init: function(content) {
        var c = d3.select(content);
        c.text('');
        c.append('h2').text('Create new game');
        var f = c.append('form')
                 .attr('onSubmit', 'return false;');
        f.on('submit', function(d) {
          var h = function(resp) {
            
          };
          var q = { action: 'createGame',
                    gameDescr: f.node()['gameDescr'].value,
                    gameName: f.node()['gameName'].value,
                    mapId: f.node()['mapId'].value };
          net.send(q, h, 1);
          return false;
        });
        
        var table = f.append('table');
        var create_table = function(d) {
          d.forEach(function(t) {
            var tr = table.append('tr');
            tr.append('td').text(t[0]);
            t[1](tr.append('td'));
          })
        };
        create_table([
          ['Game name',
           function(f) {
             f.append('input')
               .attr('type', 'textfield')
               .attr('name', 'gameName');
           }],
          ['Map', 
           function(f) {
             var h = function(resp) {
               var sel = f.append('select')
                           .attr('name', 'mapId');
               resp.maps.forEach(function(map) {
                 sel.append('option')
                   .attr('value', map.mapId)
                   .text(map.mapName);
               });
             };
             net.send({action: 'getMapList'}, h);
           }],
          ['Description',
          function(f) {
            f.append('textarea')
              .attr('name', 'gameDescr')
          }],
          ['',
           function(f) {
             f.append('input')
               .attr('type', 'submit')
               .attr('value', 'ok');
           }]
        ]);
      }
    },   

    explore_game: {
      descr: 'Explore game',
      in_menu: false,
      init: function(content, gameId) {
        var c = d3.select(content).text('');
        log.d.dump('retrive game info for gameId: ' + gameId);
        var h = function(resp) {
          var g = resp.gameInfo;
          c.append('h2')
            .text(g.gameName);
          c.append('pre')
            .text(JSON.stringify(g, null,  "  ")); 
        }
        net.send({action: 'getGameInfo', gameId: gameId}, h );
      }
    },

    users_list: {
      descr: 'Users list',
      in_menu: false,
    },

    explore_user: {
      descr: 'Explore user',
      in_menu: false,
    },

    maps_list: {
      descr: 'Maps list',
      in_menu: true,

      init: function(content) {
        var c = d3.select(content).text('');
        var h = function(resp) {
          d3.select(content).text('').node()
            .appendChild(ui_forms.maps_list.gen_form(resp.maps));
        }
        net.send({action: 'getMapList'}, h );
      }

    },

    explore_map: {
      descr: 'Explore map',
      in_menu: false,
      init: function(content, mapId) {
        var c = d3.select(content).text('');
        log.d.dump('retrive game info for gameId: ' + mapId);
        var h = function(resp) {
          var m = resp.mapInfo;
          log.d.pretty(m);
          c.append('h2')
            .text(m.mapName);
          var svg = c.append('div').append('svg:svg');
          content.appendChild(playfield.create(svg, m));
        }
        net.send({action: 'getMapInfo', mapId: mapId}, h );
      }
    },

    play_game: {
      descr: 'Play game',
      in_menu: true,
      available_if: {
        minor_m: ['in_game']
      },
      _create_ui: function() {
        var c = d3.select('div#content').text('');
            div_game_info = c.append('div')
                             .attr('id', 'game_info');
        c.append('div')
          .attr('id', 'actions');
        var div_playfield = c.append('div')
                             .attr('id', 'playfield_container')
            ans_cnt = 0,
            svg = null;

        var hg = function(resp) {
          state.store('net.getGameInfo', resp);
          state.store('net.getGameState', resp.gameInfo);

          ui_elements.game_info(div_game_info, resp.gameInfo);
          if (++ans_cnt == 2) {
            playfield.apply_game_state(
              state.get('net.getGameInfo').gameInfo);
            events.exec('game.ui_initialized');
          }
        };
        net.send({action: 'getGameInfo', 
                  sid: state.get('sid')}, hg );

        var hm = function(resp) {
          state.store('net.getMapInfo', resp);
          svg = div_playfield.append('svg:svg');
          playfield.create(svg, resp.mapInfo);
          
          if (++ans_cnt == 2) {
            playfield.apply_game_state(
              state.get('net.getGameInfo').gameInfo);
            events.exec('game.ui_initialized');
          }
        };
        net.send({action: 'getMapInfo', 
                  sid: state.get('sid')}, hm );

      },
      _watch_game_info_updates: function() {
        var h = function() {
          var data = state.get('net.getGameInfo');
          var div = d3.select('div#game_info').text('');
          ui_elements.game_info(div, data.gameInfo);
          
        };
        events.reg_h('net.getGameInfo', 
                     'major_modes.play_game->net.getGameInfo',
                     h);
      },
      init: function() {
        this._create_ui();
        this._watch_game_info_updates();                
      },
      uninit: function() {
        events.del_h('net.getGameInfo', 
                     'major_modes.play_game->net.getGameInfo');
      }
    },
  }
  
};

var minor_modes = {

  storage: {

    logined: {
      init: function() { 
        return 1;
      },
      uninit: function() {
        events.exec('state');
      }
    },
    
    in_game: {
      available_if: {
        minor_m: ['logined']
      },
      init: function() { return 1;  },
      uninit: function() {  }
    },

    game_started: {
      available_if: {
        minor_m: ['in_game']
      },
      _create_ui: function() {
        var tok = state.get(
          'net.getGameState.visibleTokenBadges',
          'net.getGameInfo.gameInfo.visibleTokenBadges'
        );
        
        if (is_null(tok)) {
          alert('visibleTokenBadges is null');
        }

        d3.select('div#game_info')
          .append('div')
          .attr('id', 'tokens_packs')
          .selectAll('div.tokens_pack')
          .data(tok)
        .enter()
          .append('div')
          .each(function(d, i) {
            var t = d3.select(this)
              .attr('class', 'tokens_pack');
            t.append('div').text(d.raceName);
            t.append('div').text(d.specialPowerName);
            t.append('div').text(d.bonusMoney);
          });
      },
      _watch_game_state_updates: function() {
        var h = function() {
          resp = state.get('net.getGameState');
          var svg = d3.select('svg#playfield')
          div_game_info = d3.select('div#game_info'),
          div_playfield = d3.select('div#playfield_container');
          
          ui_elements.update_game_info(div_game_info, resp);
          playfield.apply_game_state(resp); 

          var tok = resp.visibleTokenBadges;
          d3.select('div#tokens_packs')
            .selectAll('div.tokens_pack')
            .data(tok)
            .each(function(d) {
              d3.select(this).selectAll('div')
                .data([d.raceName, d.specialPowerName, 
                       d.bonusMoney])
                .text(String);
            });
        };
        events.reg_h('net.getGameState', 
                     'minor_modes.game_started->net.getGameState',
                     h);
      },
      init: function() {
        this._create_ui();
        this._watch_game_state_updates();
        return 0;
      },
      uninit: function() {
        event.del_h('minor_modes.game_started->net.getGameState');
      }
    },

    conquer: {
      available_if: {
        minor_m: ['in_game'],
        not_minor_m: ['redeploy', 'defend', 'waiting']
      },
      _watch_map_onclick: function() {
        var on_resp = function(resp) {
          game.request_game_state();
          alert(resp.result);
        };
        
        var h = function(reg_i) {
          net.send({"action":"conquer","regionId": reg_i}, 
                   on_resp);
        };
        events.reg_h('game.region.click',
                     'minor_modes.conquer->game.region.click',
                     h);
      },
      _prepare_ui: function() {
        var h = function() {
          d3.event.preventDefault();
          minor_modes.force('redeploy');
        };
        d3.select('div#actions')
          .append('form')
          .attr('id', 'begin_redeploy')
          .on('submit', h)
          .append('input')
            .attr('type', 'submit')
            .attr('value', 'redeploy');
      },
      init : function() {
        this._watch_map_onclick();
        this._prepare_ui();

        return 0;
      },
      uninit: function() {
        events.del_h('game.region.click',
                     'minor_modes.conquer->game.region.click');
        d3.select('form#begin_redeploy').remove();

        minor_modes.disable('select_race');
        minor_modes.disable('decline');
      }
    },

    select_race: {
      available_if: {
        minor_m: ['conquer'],
      },
      init : function() {
        var on_resp = function(resp) {
          // TODO:
          game.request_game_state();
          alert(resp.result);
        };
        var h = function(d, i) {
          net.send({"position": d.position,
                    "action":"selectRace"}, 
                   on_resp);
          d3.event.preventDefault();
        };

        d3.selectAll('div.tokens_pack')
          .append('form')
            .classed('select_race', 1)
            .on('submit', h)
          .append('input')
            .attr('name', 'ok')
            .attr('type', 'submit')
            .attr('value', 'select');
        return 0;
      },
      uninit: function() {
        d3.selectAll('form.select_race').remove();
      }
    },

    decline: {
      available_if: {
        minor_m: ['conquer'],
      },
      init : function() {
        var on_resp = function(resp) {
          // TODO:
          game.request_game_state();
          alert(resp.result);
        };

        var h = function() {
          net.send({action: 'decline'}, on_resp);
          d3.event.preventDefault();
        };

        d3.select('div.active_player')
          .append('form')
            .attr('id', 'go_decline')
            .on('submit', h)
          .append('input')
            .attr('name', 'ok')
            .attr('type', 'submit')
            .attr('value', 'decline');
        return 0;
      },
      uninit: function() {
        d3.select('form#go_decline').remove();
      }
    },

    redeploy: {
      available_if: {
        minor_m: ['in_game'],
        not_minor_m: ['decline', 'select_race',
                      'conquer', 'defend', 'waiting']
      },
      _prepare_redeploy_data: function() {
        var regions = state.get('net.getGameState.regions');
        var res = [];
        for (var i in regions) {
          var r = regions[i];
          if (r.owner == state.get('userId')) {
            res.push({tokensNum: r.tokensNum,
                      regionId: i});
          }
        }
        return res;
      },
      _send_redeploy: function() {
        var data = this._prepare_redeploy_data();
        var h = function(resp) {
          if (resp.result !== 'ok') {
            minor_modes.force('redeploy');
          }
          alert(resp.result);
          minor_modes.force('redeployed');
        };
        net.send({"regions": data, action: "redeploy"}, h, 1);
      },
      _prepare_ui: function() {
        var h = function() {
          d3.event.preventDefault();
          minor_modes.storage.redeploy._send_redeploy();
        };
        d3.select('div#actions')
          .append('form')
          .attr('id', 'finish_redeploy')
          .on('submit', h)
          .append('input')
            .attr('type', 'submit')
            .attr('value', 'submit');
      },
      _prepare_map_actions: function() {
        var plus = function(reg_i) {
          var regions = state.get('net.getGameState.regions');
          var player = game.active_player();
          
          if (!player.tokensInHand) {
            alert('no tokens in hand')
          } else {
            --player.tokensInHand;
            ++regions[reg_i].tokensNum;
            events.exec('net.getGameState');
          }
        };
        events.reg_h('game.region.click',
                     'minor_modes.conquer->game.region.click',
                     plus);
        var minus = function(reg_i) {
          var regions = state.get('net.getGameState.regions');
          var player = game.active_player();
          
          if (!regions[reg_i].tokensNum) {
            alert('no tokens on region')
          } else {
            ++player.tokensInHand;
            --regions[reg_i].tokensNum;
            events.exec('net.getGameState');
          }
        };
        events.reg_h('game.region.image.click',
                     'minor_modes.conquer->game.region.image.click',
                     minus);
      },
      init : function() {
        this._prepare_ui();
        this._prepare_map_actions();
        return 0;
      },
      uninit: function() {
        events.del_h('game.region.click',
                     'minor_modes.conquer->game.region.click');
        d3.select('form#finish_redeploy').remove();
      }
    },

    redeployed: {
      available_if: {
        minor_m: ['in_game'],
        not_minor_m: ['conquer', 'redeploy', 'waiting']
      },
      init : function() {
        var on_resp = function(resp) {
          alert(resp.result);
          if (resp.result == 'ok')  {
            minor_modes.force('waiting');
          }
        };
        var h = function() {
          d3.event.preventDefault();
          net.send({action: 'finishTurn'}, on_resp, 1)
        };
        d3.select('div#actions')
          .append('form')
          .attr('id', 'finish_turn')
          .on('submit', h)
          .append('input')
            .attr('type', 'submit')
            .attr('value', 'finish_turn');
        return 0;
      },
      uninit: function() {
        d3.select('form#finish_turn').remove();
      }
    },

    declined: {
      available_if: {
        minor_m: ['in_game'],
        not_minor_m: ['conquer', 'redeploy', 'waiting']
      },
      init : function() {
        var on_resp = function(resp) {
          alert(resp.result);
          if (resp.result == 'ok')  {
            minor_modes.force('waiting');
          }
        };
        var h = function() {
          d3.event.preventDefault();
          net.send({action: 'finishTurn'}, on_resp, 1)
        };
        d3.select('div#actions')
          .append('form')
          .attr('id', 'finish_turn')
          .on('submit', h)
          .append('input')
            .attr('type', 'submit')
            .attr('value', 'finish_turn');
        return 0;
      },
      uninit: function() {
        d3.select('form#finish_turn').remove();
      }
    },
    
    defend: {
      available_if: {
        minor_m: ['in_game'],
        not_minor_m: ['conquer', 'redeploy', 'waiting']
      },
      init : function() {
        var r_m = minor_modes.storage.redeploy;
        var h = function() {
          var data = r_m._prepare_redeploy_data();
          var h = function(resp) {
            if (resp.result !== 'ok') {
              minor_modes.force('defend');
            }
            alert(resp.result);
            minor_modes.force('waiting');
          };
          net.send({"regions": data, action: "defend"}, h, 1);
        };

        r_m._prepare_ui.call(r_m);
        r_m._prepare_map_actions.call(r_m);
        d3.select('form#finish_redeploy')
          .on('submit', h);
        return 0;
      },
      uninit: function() {
        minor_modes.storage.redeploy.uninit();
      }
    },

    waiting: {
      available_if: {
        minor_m: ['in_game'],
        not_minor_m: ['conquer', 'redeploy', 'redeployed', 'defend',
                      'declined']
      },
      init : function() {
        game.state_monitor.start();
        return 0;
      },
      uninit: function() {
        game.state_monitor.stop();
      }
    }
  }
};

minor_modes.have = function(mode) {
  return in_arr(mode, curr_modes.minor);
}; 

minor_modes._enable = function(mode, force, params) {
  if (in_arr(mode, curr_modes.minor)) {
    log.d.warn('mode ' + mode + ' already enabled');
    return 0;
  }

  var m_obj = this.storage[mode];
  if (is_null(m_obj)) {
    log.d.error('bad mode: ' + mode );
  }

  if (!_check_if_mod_available(m_obj, force)) {
    log.d.warn('mode is not avaible');
    return 0;
  }

  log.d.info("|minor mode| -> " + mode);
  log.d.dump(params, 'params');
  curr_modes.minor.push(mode);

  if (force) {
    if (!is_null(m_obj.available_if.not_minor_m)) {
      var c = m_obj.available_if.not_minor_m;
      var len = c.length;
      var i = 0;
      for (; i < len; ++i) {
        minor_modes.disable(c[i]);
        if (c.length < len) {
          len = c.length;
          i = 0;
        }
      }
    }
  }

  log.ui.modes(curr_modes);

  if (!this.storage[mode].init(params)) {
    return 0;
  }

  ui.create_menu();

  return 1;
};

minor_modes.enable = function(mode, params) {
  return this._enable(mode, 0, params);
};

minor_modes.force = function(mode, params) {
  return this._enable(mode, 1, params);
};

minor_modes.disable = function(mode) {

  if (!(in_arr(mode, curr_modes.minor))) {
    log.d.warn('mode ' + mode + ' is not active');
    return 0;
  }

  log.d.info("|minor mode| -- " + mode);

  var len = curr_modes.minor.length;
  for (var i = 0; i < len; ++i) {
    var mi_name = curr_modes.minor[i];
    if (mi_name == mode) {
      curr_modes.minor.splice(i, 1);
      --i;
      --len;
    }
  }

  var len = curr_modes.minor.length;
  for (var i = 0; i < len; ++i) {
    var mi_name = curr_modes.minor[i];
    var mi = minor_modes.storage[mi_name];
    if (!is_null(mi.available_if) &&
        !is_null(mi.available_if.minor_m))
    {
      if (in_arr(mode, mi.available_if.minor_m)) {
        log.d.info('depended mode disabled: ' + mi_name);
        minor_modes.disable(mi_name);
        i = 0;
        len = curr_modes.minor.length;
      }
    }
  }

  if (!is_null(this.storage[mode].uninit)) {
    this.storage[mode].uninit();
  }

  ui.create_menu();

  log.ui.modes(curr_modes);
  return 1;
};

function _check_if_mod_available(m_obj, only_dependencies) {
  if (is_null(m_obj.available_if)) {
    return true;
  }
  if (!is_null(m_obj.available_if.major_m)) {
    var c = m_obj.available_if.major_m;
      var ok = 0;
    for (var i = 0; i < c.length && !ok; ++i) {
        ok = curr_modes.major == c[i]
    }
    if (!ok) { return false; }
  }
  if (!is_null(m_obj.available_if.minor_m)) {
    var c = m_obj.available_if.minor_m;
    var ok = 0;
    for (var i = 0; i < c.length && !ok; ++i) {
      ok = in_arr(c[i], curr_modes.minor)
    }
    if (!ok) { return false; }
  }

  if (!is_null(m_obj.available_if.not_major_m)) { 
    var c = m_obj.available_if.major_m;
    for (var i = 0; i < c.length; ++i) {
      if (curr_modes.major == c[i]) {
        return false;
      }
    }
  }

  if (zero_or_one(only_dependencies)) {
    return true;
  }

  if (!is_null(m_obj.available_if.not_minor_m)) {
    var c = m_obj.available_if.not_minor_m;
    for (var i = 0; i < c.length; ++i) {
      if (in_arr(c[i], curr_modes.minor)) {
        return false;
      }
    }
  }
  
  return true;
}

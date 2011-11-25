
var log = {
  d: {
    info: function(msg) { console.info('[info] ' + msg) },
    warn: function(msg) { console.warn('[warn] ' + msg) },
    error: function(msg) { console.error('[error] ' + msg) },
    //dump: function(obj) { console.dir(obj) }
    dump: function(obj, descr) { 
      var t = '';
      if (descr) { t = descr + ': ' }
      console.info(t + JSON.stringify(obj))
    }
  },
  ui: {
    info: function(msg) { alert('[info] ' + msg) },
    warn: function(msg) { alert('[warn] ' + msg) },
    error: function(msg) { alert('[error] ' + msg) },
  }

};
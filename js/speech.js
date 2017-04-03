/* global annyang, voiceUI */

(function () {
  var IS_PROD = !window.location.port && window.location.protocol === 'https:';

  var SETTINGS = {
    dev: !IS_PROD,
    prod: IS_PROD,
    env: IS_PROD ? 'production' : 'development',
    putio: {
      clientId: 2801
    }
  };

  var URLS = {
    base: SETTINGS.prod ? 'https://popeye-api.herokuapp.com' : 'http://localhost:7001',
    putioBase: 'https://api.put.io/v2'
  };
  URLS.latestEpisode = function (id) { return `${URLS.base}/latestEpisode?show=${id}`; };
  URLS.putioTransfersAdd = function (accessToken) { return `${URLS.putioBase}/transfers/add?oauth_token=${accessToken}`; };

  // Generate the URL for the user to log in to Put.io and get redirected back to this page.
  var redirectUri = encodeURIComponent(window.location.href);
  var nextUri = encodeURIComponent(`${URLS.putioBase}/oauth2/authenticate?client_id=${SETTINGS.putio.clientId}&response_type=token&redirect_uri=${redirectUri}`);
  URLS.putioLogin = `${URLS.putioBase}/oauth2/login?next=${nextUri}`;

  var URLHashParams = function (hash) {
    hash = (hash || window.location.hash.substr(1)).toString().trim();
    var hashObj = {};
    if (hash) {
      var hashPairs = hash.split('&');
      for (var i = 0; i < hashPairs.length; ++i) {
        var hashChunks = hash[i].split('=', 2);
        hashObj[hashChunks[0]] = hashChunks.length === 1 ? '' : window.decodeURIComponent(hashChunks[1].replace(/\+/g, ' '));
      }
    }
    return hashObj;
  };

  var HASH = URLHashParams();

  if (!('URLHashParams' in window)) {
    window.URLHashParams = URLHashParams;
  }
  if (!('HASH' in window)) {
    window.HASH = HASH;
  }

  window.addEventListener('hashchange', function () {
    HASH = URLHashParams();
  });

  var xhr = function (opts) {
    if (typeof opts === 'string') {
      opts = {
        url: opts
      };
    }
    opts = opts || {};
    opts.method = opts.method || 'get';
    if (typeof opts.data === 'object') {
      var formData = new FormData();
      Object.keys(opts.data).forEach(function (prop) {
        formData.append(prop, opts.data[prop]);
      });
      opts.data = formData;
    }
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method, opts.url, 'true');
      xhr.addEventListener('load', function () {
        resolve(xhr.responseText);
      });
      xhr.addEventListener('error', reject);
      xhr.send(opts.data);
    });
  };

  var uploadMovie = function (movie) {
    console.log(`download ${movie}`);
  };

  var uploadTVEpisode = function (show) {
    logCommand('Latest show: ' + show);

    show = encodeURI(show);

    var fetchEp = function () {
      return xhr({
        method: 'get',
        url: URLS.latestEpisode(show)
      }).then(function (data) {
        data = JSON.parse(data);
        return data || {};
      });
    };

    var displayEp = function (data) {
      return new Promise(function (resolve, reject) {
        data.voiceCommand = 'upload the latest episode of ' + decodeURI(show);
        voiceUI.addEpInfo(data);
        voiceUI.resultsShow();
        resolve(data);
      });
    };

    var addTransfer = function (data) {
      return xhr({
        method: 'post',
        url: URLS.putioTransfersAdd(HASH.access_token),
        data: {
          url: data.magnetLink
        }
      }).then(function (data) {
        // TODO: Do something with this return data.
        logCommand('Add transfer data: ' + data);
      });
    };

    var handleProblems = function (err) {
      console.error(err);
    };

    return fetchEp()
      .then(displayEp)
      .then(addTransfer)
      .catch(handleProblems);
  };

  var commandLogsEl = document.querySelector('#command-logs');
  var logCommand = function (cmd) {
    console.log(cmd);
    var li = document.createElement('li');
    li.textContent = cmd;
    commandLogsEl.appendChild(li);
  };

  var logInBtnEl = document.querySelector('#log-in-btn');
  if (logInBtnEl) {
    logInBtnEl.setAttribute('href', URLS.putioLogin);
  }

  if (!annyang) {
    throw new Error('Could not find `annyang` library');
  }

  annyang.addCallback('soundstart', function () {
    console.log('Speech detected');
  });

  annyang.addCallback('result', function () {
    console.log('Speech stopped');
  });

  var speechCommands = {
    'upload (the) movie *movie': uploadMovie,
    'upload (the) latest episode of *show': uploadTVEpisode,
    'hello': function () { alert('hello'); }
  };

  annyang.addCommands(speechCommands);

  annyang.start();
  annyang.pause();
})();

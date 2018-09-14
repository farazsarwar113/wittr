import PostsView from './views/Posts';
import ToastsView from './views/Toasts';
import idb from 'idb';

export default function IndexController(container) {
  this._container = container;
  this._postsView = new PostsView(this._container);
  this._toastsView = new ToastsView(this._container);
  this._lostConnectionToast = null;
  this._openSocket();
  this._registerServiceWorker();
}

IndexController.prototype._registerServiceWorker = function() {
  if (!navigator.serviceWorker) return;

  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    console.log('Registration worked!');
    reg.unregister(); // Unregister the service worker
    reg.update(); // update the service worker with the latest installed service worker
    reg.installing; // That's tell us that updates is on its way although it might be thrown away if fails
    reg.waiting; // There is an update and SW is ready to take over
    reg.active; // SW is in active state. 
    // EMIT an event when new update is found
    reg.addEventListener('updateFound', function() {
      // reg.installing has changed and becomes new SW
    });

    // We can also look at their state
    var sw = reg.installing;
    console.log(sw.state); // logs installing i.e install event fired but hasnt yet completed
    // state can also be
    // 'installed'  -> installation complete but hasnt yet activated
    // 'activating' -> activate event is fired but hasnt yet completed or activated
    // 'activated'  -> SW is ready to receive fetch events
    // 'redudant'   -> SW has been thrown away
    
    // sw fires an event 'statechange' whenver the state of reg object changes
    sw.addEventListener('statechange', function() {
      // sw.state has been changed
    });

    navigator.serviceWorker.controller; // refers to SW that control the page 
    // if there is no controller that mean: page didnt load using the SW if fetch from network

    if (reg.waiting) {
      // there's an update ready
      // tell the user
    }
    if (reg.installing) {
      // there's an update in progress
    }
    // it may be fail to check this we add an event to installing state and check for change in state
    reg.installing.addEventListener('statechange', function() {
      if (this.state === 'installed') {
        // there's an update ready
      }
    });
    // otherwise we check for update found event and check the state of installing
    reg.addEventListener('updatefound', function() {
      reg.installing.addEventListener('statechange', function() {
        if (this.state === 'installed') {
          // there's an update ready
        }
      });
    });

  }).catch(function() {
    console.log('Registration failed!');
  });
};

// open a connection to the server for live updates
IndexController.prototype._openSocket = function() {
  var indexController = this;
  var latestPostDate = this._postsView.getLatestPostDate();

  // create a url pointing to /updates with the ws protocol
  var socketUrl = new URL('/updates', window.location);
  socketUrl.protocol = 'ws';

  if (latestPostDate) {
    socketUrl.search = 'since=' + latestPostDate.valueOf();
  }

  // this is a little hack for the settings page's tests,
  // it isn't needed for Wittr
  socketUrl.search += '&' + location.search.slice(1);

  var ws = new WebSocket(socketUrl.href);

  // add listeners
  ws.addEventListener('open', function() {
    if (indexController._lostConnectionToast) {
      indexController._lostConnectionToast.hide();
    }
  });

  ws.addEventListener('message', function(event) {
    requestAnimationFrame(function() {
      indexController._onSocketMessage(event.data);
    });
  });

  ws.addEventListener('close', function() {
    // tell the user
    if (!indexController._lostConnectionToast) {
      indexController._lostConnectionToast = indexController._toastsView.show("Unable to connect. Retrying…");
    }

    // try and reconnect in 5 seconds
    setTimeout(function() {
      indexController._openSocket();
    }, 5000);
  });
};

// called when the web socket sends message data
IndexController.prototype._onSocketMessage = function(data) {
  var messages = JSON.parse(data);
  this._postsView.addPosts(messages);
};
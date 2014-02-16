(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var utils = require('./utils'),
    queue, has, waiting

reset()

exports.queue = function (binding) {
    if (!has[binding.id]) {
        queue.push(binding)
        has[binding.id] = true
        if (!waiting) {
            waiting = true
            utils.nextTick(flush)
        }
    }
}

function flush () {
    for (var i = 0; i < queue.length; i++) {
        var b = queue[i]
        if (b.unbound) continue
        b._update()
        has[b.id] = false
    }
    reset()
}

function reset () {
    queue = []
    has = utils.hash()
    waiting = false
}
},{"./utils":23}],3:[function(require,module,exports){
var batcher = require('./batcher'),
    id = 0

/**
 *  Binding class.
 *
 *  each property on the viewmodel has one corresponding Binding object
 *  which has multiple directive instances on the DOM
 *  and multiple computed property dependents
 */
function Binding (compiler, key, isExp, isFn) {
    this.id = id++
    this.value = undefined
    this.isExp = !!isExp
    this.isFn = isFn
    this.root = !this.isExp && key.indexOf('.') === -1
    this.compiler = compiler
    this.key = key
    this.dirs = []
    this.subs = []
    this.deps = []
    this.unbound = false
}

var BindingProto = Binding.prototype

/**
 *  Update value and queue instance updates.
 */
BindingProto.update = function (value) {
    if (!this.isComputed || this.isFn) {
        this.value = value
    }
    if (this.dirs.length || this.subs.length) {
        batcher.queue(this)
    }
}

/**
 *  Actually update the directives.
 */
BindingProto._update = function () {
    var i = this.dirs.length,
        value = this.val()
    while (i--) {
        this.dirs[i].update(value)
    }
    this.pub()
}

/**
 *  Return the valuated value regardless
 *  of whether it is computed or not
 */
BindingProto.val = function () {
    return this.isComputed && !this.isFn
        ? this.value.$get()
        : this.value
}

/**
 *  Notify computed properties that depend on this binding
 *  to update themselves
 */
BindingProto.pub = function () {
    var i = this.subs.length
    while (i--) {
        this.subs[i].update()
    }
}

/**
 *  Unbind the binding, remove itself from all of its dependencies
 */
BindingProto.unbind = function () {
    // Indicate this has been unbound.
    // It's possible this binding will be in
    // the batcher's flush queue when its owner
    // compiler has already been destroyed.
    this.unbound = true
    var i = this.dirs.length
    while (i--) {
        this.dirs[i].unbind()
    }
    i = this.deps.length
    var subs
    while (i--) {
        subs = this.deps[i].subs
        subs.splice(subs.indexOf(this), 1)
    }
}

module.exports = Binding
},{"./batcher":2}],4:[function(require,module,exports){
var Emitter     = require('./emitter'),
    Observer    = require('./observer'),
    config      = require('./config'),
    utils       = require('./utils'),
    Binding     = require('./binding'),
    Directive   = require('./directive'),
    TextParser  = require('./text-parser'),
    DepsParser  = require('./deps-parser'),
    ExpParser   = require('./exp-parser'),
    
    // cache methods
    slice       = Array.prototype.slice,
    log         = utils.log,
    makeHash    = utils.hash,
    extend      = utils.extend,
    def         = utils.defProtected,
    hasOwn      = Object.prototype.hasOwnProperty,

    // hooks to register
    hooks = [
        'created', 'ready',
        'beforeDestroy', 'afterDestroy',
        'attached', 'detached'
    ]

/**
 *  The DOM compiler
 *  scans a DOM node and compile bindings for a ViewModel
 */
function Compiler (vm, options) {

    var compiler = this
    // indicate that we are intiating this instance
    // so we should not run any transitions
    compiler.init = true

    // process and extend options
    options = compiler.options = options || makeHash()
    utils.processOptions(options)

    // copy data, methods & compiler options
    var data = compiler.data = options.data || {}
    extend(vm, data, true)
    extend(vm, options.methods, true)
    extend(compiler, options.compilerOptions)

    // initialize element
    var el = compiler.setupElement(options)
    log('\nnew VM instance:', el.tagName, '\n')

    // set compiler properties
    compiler.vm  = vm
    compiler.bindings = makeHash()
    compiler.dirs = []
    compiler.deferred = []
    compiler.exps = []
    compiler.computed = []
    compiler.childCompilers = []
    compiler.emitter = new Emitter()

    // set inenumerable VM properties
    def(vm, '$', makeHash())
    def(vm, '$el', el)
    def(vm, '$compiler', compiler)
    def(vm, '$root', getRoot(compiler).vm)

    // set parent VM
    // and register child id on parent
    var parent = compiler.parentCompiler,
        childId = utils.attr(el, 'ref')
    if (parent) {
        parent.childCompilers.push(compiler)
        def(vm, '$parent', parent.vm)
        if (childId) {
            compiler.childId = childId
            parent.vm.$[childId] = vm
        }
    }

    // setup observer
    compiler.setupObserver()

    // create bindings for computed properties
    var computed = options.computed
    if (computed) {
        for (var key in computed) {
            compiler.createBinding(key)
        }
    }

    // beforeCompile hook
    compiler.execHook('created')

    // the user might have set some props on the vm 
    // so copy it back to the data...
    extend(data, vm)

    // observe the data
    compiler.observeData(data)
    
    // for repeated items, create an index binding
    // which should be inenumerable but configurable
    if (compiler.repeat) {
        //data.$index = compiler.repeatIndex
        def(data, '$index', compiler.repeatIndex, false, true)
        compiler.createBinding('$index')
    }

    // now parse the DOM, during which we will create necessary bindings
    // and bind the parsed directives
    compiler.compile(el, true)

    // bind deferred directives (child components)
    compiler.deferred.forEach(compiler.bindDirective, compiler)

    // extract dependencies for computed properties
    compiler.parseDeps()

    // done!
    compiler.init = false

    // post compile / ready hook
    compiler.execHook('ready')
}

var CompilerProto = Compiler.prototype

/**
 *  Initialize the VM/Compiler's element.
 *  Fill it in with the template if necessary.
 */
CompilerProto.setupElement = function (options) {
    // create the node first
    var el = this.el = typeof options.el === 'string'
        ? document.querySelector(options.el)
        : options.el || document.createElement(options.tagName || 'div')

    var template = options.template
    if (template) {
        // replace option: use the first node in
        // the template directly
        if (options.replace && template.childNodes.length === 1) {
            var replacer = template.childNodes[0].cloneNode(true)
            if (el.parentNode) {
                el.parentNode.insertBefore(replacer, el)
                el.parentNode.removeChild(el)
            }
            el = replacer
        } else {
            el.innerHTML = ''
            el.appendChild(template.cloneNode(true))
        }
    }

    // apply element options
    if (options.id) el.id = options.id
    if (options.className) el.className = options.className
    var attrs = options.attributes
    if (attrs) {
        for (var attr in attrs) {
            el.setAttribute(attr, attrs[attr])
        }
    }

    return el
}

/**
 *  Setup observer.
 *  The observer listens for get/set/mutate events on all VM
 *  values/objects and trigger corresponding binding updates.
 *  It also listens for lifecycle hooks.
 */
CompilerProto.setupObserver = function () {

    var compiler = this,
        bindings = compiler.bindings,
        options  = compiler.options,
        observer = compiler.observer = new Emitter()

    // a hash to hold event proxies for each root level key
    // so they can be referenced and removed later
    observer.proxies = makeHash()

    // add own listeners which trigger binding updates
    observer
        .on('get', onGet)
        .on('set', onSet)
        .on('mutate', onSet)

    // register hooks
    hooks.forEach(function (hook) {
        var fns = options[hook]
        if (Array.isArray(fns)) {
            var i = fns.length
            // since hooks were merged with child at head,
            // we loop reversely.
            while (i--) {
                register(hook, fns[i])
            }
        } else if (fns) {
            register(hook, fns)
        }
    })

    function onGet (key) {
        check(key)
        DepsParser.catcher.emit('get', bindings[key])
    }

    function onSet (key, val, mutation) {
        observer.emit('change:' + key, val, mutation)
        check(key)
        bindings[key].update(val)
    }

    function register (hook, fn) {
        observer.on('hook:' + hook, function () {
            fn.call(compiler.vm, options)
        })
    }

    function check (key) {
        if (!bindings[key]) {
            compiler.createBinding(key)
        }
    }
}

CompilerProto.observeData = function (data) {

    var compiler = this,
        observer = compiler.observer

    // recursively observe nested properties
    Observer.observe(data, '', observer)

    // also create binding for top level $data
    // so it can be used in templates too
    var $dataBinding = compiler.bindings['$data'] = new Binding(compiler, '$data')
    $dataBinding.update(data)

    // allow $data to be swapped
    Object.defineProperty(compiler.vm, '$data', {
        enumerable: false,
        get: function () {
            compiler.observer.emit('get', '$data')
            return compiler.data
        },
        set: function (newData) {
            var oldData = compiler.data
            Observer.unobserve(oldData, '', observer)
            compiler.data = newData
            Observer.copyPaths(newData, oldData)
            Observer.observe(newData, '', observer)
            compiler.observer.emit('set', '$data', newData)
        }
    })

    // emit $data change on all changes
    observer
        .on('set', onSet)
        .on('mutate', onSet)

    function onSet (key) {
        if (key !== '$data') {
            $dataBinding.update(compiler.data)
        }
    }
}

/**
 *  Compile a DOM node (recursive)
 */
CompilerProto.compile = function (node, root) {

    var compiler = this,
        nodeType = node.nodeType,
        tagName  = node.tagName

    if (nodeType === 1 && tagName !== 'SCRIPT') { // a normal node

        // skip anything with v-pre
        if (utils.attr(node, 'pre') !== null) return

        // special attributes to check
        var repeatExp,
            withKey,
            partialId,
            directive,
            componentId = utils.attr(node, 'component') || tagName.toLowerCase(),
            componentCtor = compiler.getOption('components', componentId)

        // It is important that we access these attributes
        // procedurally because the order matters.
        //
        // `utils.attr` removes the attribute once it gets the
        // value, so we should not access them all at once.

        // v-repeat has the highest priority
        // and we need to preserve all other attributes for it.
        /* jshint boss: true */
        if (repeatExp = utils.attr(node, 'repeat')) {

            // repeat block cannot have v-id at the same time.
            directive = Directive.parse('repeat', repeatExp, compiler, node)
            if (directive) {
                directive.Ctor = componentCtor
                // defer child component compilation
                // so by the time they are compiled, the parent
                // would have collected all bindings
                compiler.deferred.push(directive)
            }

        // v-with has 2nd highest priority
        } else if (root !== true && ((withKey = utils.attr(node, 'with')) || componentCtor)) {

            directive = Directive.parse('with', withKey || '', compiler, node)
            if (directive) {
                directive.Ctor = componentCtor
                compiler.deferred.push(directive)
            }

        } else {

            // check transition property
            node.vue_trans = utils.attr(node, 'transition')
            
            // replace innerHTML with partial
            partialId = utils.attr(node, 'partial')
            if (partialId) {
                var partial = compiler.getOption('partials', partialId)
                if (partial) {
                    node.innerHTML = ''
                    node.appendChild(partial.cloneNode(true))
                }
            }

            // finally, only normal directives left!
            compiler.compileNode(node)
        }

    } else if (nodeType === 3) { // text node

        compiler.compileTextNode(node)

    }

}

/**
 *  Compile a normal node
 */
CompilerProto.compileNode = function (node) {
    var i, j,
        attrs = slice.call(node.attributes),
        prefix = config.prefix + '-'
    // parse if has attributes
    if (attrs && attrs.length) {
        var attr, isDirective, exps, exp, directive, dirname
        // loop through all attributes
        i = attrs.length
        while (i--) {
            attr = attrs[i]
            isDirective = false

            if (attr.name.indexOf(prefix) === 0) {
                // a directive - split, parse and bind it.
                isDirective = true
                exps = Directive.split(attr.value)
                // loop through clauses (separated by ",")
                // inside each attribute
                j = exps.length
                while (j--) {
                    exp = exps[j]
                    dirname = attr.name.slice(prefix.length)
                    directive = Directive.parse(dirname, exp, this, node)
                    if (directive) {
                        this.bindDirective(directive)
                    }
                }
            } else {
                // non directive attribute, check interpolation tags
                exp = TextParser.parseAttr(attr.value)
                if (exp) {
                    directive = Directive.parse('attr', attr.name + ':' + exp, this, node)
                    if (directive) {
                        this.bindDirective(directive)
                    }
                }
            }

            if (isDirective && dirname !== 'cloak') {
                node.removeAttribute(attr.name)
            }
        }
    }
    // recursively compile childNodes
    if (node.childNodes.length) {
        slice.call(node.childNodes).forEach(this.compile, this)
    }
}

/**
 *  Compile a text node
 */
CompilerProto.compileTextNode = function (node) {

    var tokens = TextParser.parse(node.nodeValue)
    if (!tokens) return
    var el, token, directive, partial, partialId, partialNodes

    for (var i = 0, l = tokens.length; i < l; i++) {
        token = tokens[i]
        directive = partialNodes = null
        if (token.key) { // a binding
            if (token.key.charAt(0) === '>') { // a partial
                partialId = token.key.slice(1).trim()
                partial = this.getOption('partials', partialId)
                if (partial) {
                    el = partial.cloneNode(true)
                    // save an Array reference of the partial's nodes
                    // so we can compile them AFTER appending the fragment
                    partialNodes = slice.call(el.childNodes)
                }
            } else { // a real binding
                if (!token.html) { // text binding
                    el = document.createTextNode('')
                    directive = Directive.parse('text', token.key, this, el)
                } else { // html binding
                    el = document.createComment(config.prefix + '-html')
                    directive = Directive.parse('html', token.key, this, el)
                }
            }
        } else { // a plain string
            el = document.createTextNode(token)
        }

        // insert node
        node.parentNode.insertBefore(el, node)

        // bind directive
        if (directive) {
            this.bindDirective(directive)
        }

        // compile partial after appending, because its children's parentNode
        // will change from the fragment to the correct parentNode.
        // This could affect directives that need access to its element's parentNode.
        if (partialNodes) {
            partialNodes.forEach(this.compile, this)
        }

    }
    node.parentNode.removeChild(node)
}

/**
 *  Add a directive instance to the correct binding & viewmodel
 */
CompilerProto.bindDirective = function (directive) {

    // keep track of it so we can unbind() later
    this.dirs.push(directive)

    // for empty or literal directives, simply call its bind()
    // and we're done.
    if (directive.isEmpty || !directive._update) {
        if (directive.bind) directive.bind()
        return
    }

    // otherwise, we got more work to do...
    var binding,
        compiler = this,
        key      = directive.key

    if (directive.isExp) {
        // expression bindings are always created on current compiler
        binding = compiler.createBinding(key, true, directive.isFn)
    } else {
        // recursively locate which compiler owns the binding
        while (compiler) {
            if (compiler.hasKey(key)) {
                break
            } else {
                compiler = compiler.parentCompiler
            }
        }
        compiler = compiler || this
        binding = compiler.bindings[key] || compiler.createBinding(key)
    }
    binding.dirs.push(directive)
    directive.binding = binding

    // invoke bind hook if exists
    if (directive.bind) {
        directive.bind()
    }

    // set initial value
    directive.update(binding.val(), true)
}

/**
 *  Create binding and attach getter/setter for a key to the viewmodel object
 */
CompilerProto.createBinding = function (key, isExp, isFn) {

    log('  created binding: ' + key)

    var compiler = this,
        bindings = compiler.bindings,
        computed = compiler.options.computed,
        binding  = new Binding(compiler, key, isExp, isFn)

    if (isExp) {
        // expression bindings are anonymous
        compiler.defineExp(key, binding)
    } else {
        bindings[key] = binding
        if (binding.root) {
            // this is a root level binding. we need to define getter/setters for it.
            if (computed && computed[key]) {
                // computed property
                compiler.defineComputed(key, binding, computed[key])
            } else {
                // normal property
                compiler.defineProp(key, binding)
            }
        } else {
            // ensure path in data so it can be observed
            Observer.ensurePath(compiler.data, key)
            var parentKey = key.slice(0, key.lastIndexOf('.'))
            if (!bindings[parentKey]) {
                // this is a nested value binding, but the binding for its parent
                // has not been created yet. We better create that one too.
                compiler.createBinding(parentKey)
            }
        }
    }
    return binding
}

/**
 *  Define the getter/setter for a root-level property on the VM
 *  and observe the initial value
 */
CompilerProto.defineProp = function (key, binding) {
    
    var compiler = this,
        data     = compiler.data,
        ob       = data.__observer__

    // make sure the key is present in data
    // so it can be observed
    if (!(key in data)) {
        data[key] = undefined
    }

    // if the data object is already observed, but the key
    // is not observed, we need to add it to the observed keys.
    if (ob && !(key in ob.values)) {
        Observer.convert(data, key)
    }

    binding.value = data[key]

    Object.defineProperty(compiler.vm, key, {
        get: function () {
            return compiler.data[key]
        },
        set: function (val) {
            compiler.data[key] = val
        }
    })
}

/**
 *  Define an expression binding, which is essentially
 *  an anonymous computed property
 */
CompilerProto.defineExp = function (key, binding) {
    var getter = ExpParser.parse(key, this)
    if (getter) {
        this.markComputed(binding, getter)
        this.exps.push(binding)
    }
}

/**
 *  Define a computed property on the VM
 */
CompilerProto.defineComputed = function (key, binding, value) {
    this.markComputed(binding, value)
    Object.defineProperty(this.vm, key, {
        get: binding.value.$get,
        set: binding.value.$set
    })
}

/**
 *  Process a computed property binding
 *  so its getter/setter are bound to proper context
 */
CompilerProto.markComputed = function (binding, value) {
    binding.isComputed = true
    // bind the accessors to the vm
    if (binding.isFn) {
        binding.value = value
    } else {
        if (typeof value === 'function') {
            value = { $get: value }
        }
        binding.value = {
            $get: utils.bind(value.$get, this.vm),
            $set: value.$set
                ? utils.bind(value.$set, this.vm)
                : undefined
        }
    }
    // keep track for dep parsing later
    this.computed.push(binding)
}

/**
 *  Retrive an option from the compiler
 */
CompilerProto.getOption = function (type, id) {
    var opts = this.options,
        parent = this.parentCompiler
    return (opts[type] && opts[type][id]) || (
        parent
            ? parent.getOption(type, id)
            : utils[type] && utils[type][id]
    )
}

/**
 *  Emit lifecycle events to trigger hooks
 */
CompilerProto.execHook = function (event) {
    event = 'hook:' + event
    this.observer.emit(event)
    this.emitter.emit(event)
}

/**
 *  Check if a compiler's data contains a keypath
 */
CompilerProto.hasKey = function (key) {
    var baseKey = key.split('.')[0]
    return hasOwn.call(this.data, baseKey) ||
        hasOwn.call(this.vm, baseKey)
}

/**
 *  Collect dependencies for computed properties
 */
CompilerProto.parseDeps = function () {
    if (!this.computed.length) return
    DepsParser.parse(this.computed)
}

/**
 *  Unbind and remove element
 */
CompilerProto.destroy = function () {

    // avoid being called more than once
    // this is irreversible!
    if (this.destroyed) return

    var compiler = this,
        i, key, dir, dirs, binding,
        vm          = compiler.vm,
        el          = compiler.el,
        directives  = compiler.dirs,
        exps        = compiler.exps,
        bindings    = compiler.bindings

    compiler.execHook('beforeDestroy')

    // unobserve data
    Observer.unobserve(compiler.data, '', compiler.observer)

    // unbind all direcitves
    i = directives.length
    while (i--) {
        dir = directives[i]
        // if this directive is an instance of an external binding
        // e.g. a directive that refers to a variable on the parent VM
        // we need to remove it from that binding's directives
        // * empty and literal bindings do not have binding.
        if (dir.binding && dir.binding.compiler !== compiler) {
            dirs = dir.binding.dirs
            if (dirs) dirs.splice(dirs.indexOf(dir), 1)
        }
        dir.unbind()
    }

    // unbind all expressions (anonymous bindings)
    i = exps.length
    while (i--) {
        exps[i].unbind()
    }

    // unbind all own bindings
    for (key in bindings) {
        binding = bindings[key]
        if (binding) {
            binding.unbind()
        }
    }

    // remove self from parentCompiler
    var parent = compiler.parentCompiler,
        childId = compiler.childId
    if (parent) {
        parent.childCompilers.splice(parent.childCompilers.indexOf(compiler), 1)
        if (childId) {
            delete parent.vm.$[childId]
        }
    }

    // finally remove dom element
    if (el === document.body) {
        el.innerHTML = ''
    } else {
        vm.$remove()
    }

    this.destroyed = true
    // emit destroy hook
    compiler.execHook('afterDestroy')

    // finally, unregister all listeners
    compiler.observer.off()
    compiler.emitter.off()
}

// Helpers --------------------------------------------------------------------

/**
 *  shorthand for getting root compiler
 */
function getRoot (compiler) {
    while (compiler.parentCompiler) {
        compiler = compiler.parentCompiler
    }
    return compiler
}

module.exports = Compiler
},{"./binding":3,"./config":5,"./deps-parser":6,"./directive":7,"./emitter":16,"./exp-parser":17,"./observer":20,"./text-parser":21,"./utils":23}],5:[function(require,module,exports){
var prefix = 'v',
    specialAttributes = [
        'pre',
        'ref',
        'with',
        'text',
        'repeat',
        'partial',
        'component',
        'transition'
    ],
    config = module.exports = {

        debug       : false,
        silent      : false,
        enterClass  : 'v-enter',
        leaveClass  : 'v-leave',
        attrs       : {},

        get prefix () {
            return prefix
        },
        set prefix (val) {
            prefix = val
            updatePrefix()
        }
        
    }

function updatePrefix () {
    specialAttributes.forEach(function (attr) {
        config.attrs[attr] = prefix + '-' + attr
    })
}

updatePrefix()
},{}],6:[function(require,module,exports){
var Emitter  = require('./emitter'),
    utils    = require('./utils'),
    Observer = require('./observer'),
    catcher  = new Emitter()

/**
 *  Auto-extract the dependencies of a computed property
 *  by recording the getters triggered when evaluating it.
 */
function catchDeps (binding) {
    if (binding.isFn) return
    utils.log('\n- ' + binding.key)
    var got = utils.hash()
    binding.deps = []
    catcher.on('get', function (dep) {
        var has = got[dep.key]
        if (has && has.compiler === dep.compiler) return
        got[dep.key] = dep
        utils.log('  - ' + dep.key)
        binding.deps.push(dep)
        dep.subs.push(binding)
    })
    binding.value.$get()
    catcher.off('get')
}

module.exports = {

    /**
     *  the observer that catches events triggered by getters
     */
    catcher: catcher,

    /**
     *  parse a list of computed property bindings
     */
    parse: function (bindings) {
        utils.log('\nparsing dependencies...')
        Observer.shouldGet = true
        bindings.forEach(catchDeps)
        Observer.shouldGet = false
        utils.log('\ndone.')
    }
    
}
},{"./emitter":16,"./observer":20,"./utils":23}],7:[function(require,module,exports){
var utils      = require('./utils'),
    directives = require('./directives'),
    filters    = require('./filters'),

    // Regexes!

    // regex to split multiple directive expressions
    // split by commas, but ignore commas within quotes, parens and escapes.
    SPLIT_RE        = /(?:['"](?:\\.|[^'"])*['"]|\((?:\\.|[^\)])*\)|\\.|[^,])+/g,

    // match up to the first single pipe, ignore those within quotes.
    KEY_RE          = /^(?:['"](?:\\.|[^'"])*['"]|\\.|[^\|]|\|\|)+/,

    ARG_RE          = /^([\w-$ ]+):(.+)$/,
    FILTERS_RE      = /\|[^\|]+/g,
    FILTER_TOKEN_RE = /[^\s']+|'[^']+'/g,
    NESTING_RE      = /^\$(parent|root)\./,
    SINGLE_VAR_RE   = /^[\w\.$]+$/

/**
 *  Directive class
 *  represents a single directive instance in the DOM
 */
function Directive (definition, expression, rawKey, compiler, node) {

    this.compiler = compiler
    this.vm       = compiler.vm
    this.el       = node

    var isEmpty  = expression === ''

    // mix in properties from the directive definition
    if (typeof definition === 'function') {
        this[isEmpty ? 'bind' : '_update'] = definition
    } else {
        for (var prop in definition) {
            if (prop === 'unbind' || prop === 'update') {
                this['_' + prop] = definition[prop]
            } else {
                this[prop] = definition[prop]
            }
        }
    }

    // empty expression, we're done.
    if (isEmpty) {
        this.isEmpty = true
        return
    }

    this.expression = expression.trim()
    this.rawKey     = rawKey
    
    parseKey(this, rawKey)

    this.isExp = !SINGLE_VAR_RE.test(this.key) || NESTING_RE.test(this.key)
    
    var filterExps = this.expression.slice(rawKey.length).match(FILTERS_RE)
    if (filterExps) {
        this.filters = []
        for (var i = 0, l = filterExps.length, filter; i < l; i++) {
            filter = parseFilter(filterExps[i], this.compiler)
            if (filter) this.filters.push(filter)
        }
        if (!this.filters.length) this.filters = null
    } else {
        this.filters = null
    }
}

var DirProto = Directive.prototype

/**
 *  parse a key, extract argument and nesting/root info
 */
function parseKey (dir, rawKey) {
    var key = rawKey
    if (rawKey.indexOf(':') > -1) {
        var argMatch = rawKey.match(ARG_RE)
        key = argMatch
            ? argMatch[2].trim()
            : key
        dir.arg = argMatch
            ? argMatch[1].trim()
            : null
    }
    dir.key = key
}

/**
 *  parse a filter expression
 */
function parseFilter (filter, compiler) {

    var tokens = filter.slice(1).match(FILTER_TOKEN_RE)
    if (!tokens) return
    tokens = tokens.map(function (token) {
        return token.replace(/'/g, '').trim()
    })

    var name = tokens[0],
        apply = compiler.getOption('filters', name) || filters[name]
    if (!apply) {
        utils.warn('Unknown filter: ' + name)
        return
    }

    return {
        name  : name,
        apply : apply,
        args  : tokens.length > 1
                ? tokens.slice(1)
                : null
    }
}

/**
 *  called when a new value is set 
 *  for computed properties, this will only be called once
 *  during initialization.
 */
DirProto.update = function (value, init) {
    var type = utils.typeOf(value)
    if (init || value !== this.value || type === 'Object' || type === 'Array') {
        this.value = value
        if (this._update) {
            this._update(
                this.filters
                    ? this.applyFilters(value)
                    : value
            )
        }
    }
}

/**
 *  pipe the value through filters
 */
DirProto.applyFilters = function (value) {
    var filtered = value, filter
    for (var i = 0, l = this.filters.length; i < l; i++) {
        filter = this.filters[i]
        filtered = filter.apply.call(this.vm, filtered, filter.args)
    }
    return filtered
}

/**
 *  Unbind diretive
 */
DirProto.unbind = function () {
    // this can be called before the el is even assigned...
    if (!this.el || !this.vm) return
    if (this._unbind) this._unbind()
    this.vm = this.el = this.binding = this.compiler = null
}

// exposed methods ------------------------------------------------------------

/**
 *  split a unquoted-comma separated expression into
 *  multiple clauses
 */
Directive.split = function (exp) {
    return exp.indexOf(',') > -1
        ? exp.match(SPLIT_RE) || ['']
        : [exp]
}

/**
 *  make sure the directive and expression is valid
 *  before we create an instance
 */
Directive.parse = function (dirname, expression, compiler, node) {

    var dir = compiler.getOption('directives', dirname) || directives[dirname]
    if (!dir) return utils.warn('unknown directive: ' + dirname)

    var rawKey
    if (expression.indexOf('|') > -1) {
        var keyMatch = expression.match(KEY_RE)
        if (keyMatch) {
            rawKey = keyMatch[0].trim()
        }
    } else {
        rawKey = expression.trim()
    }
    
    // have a valid raw key, or be an empty directive
    return (rawKey || expression === '')
        ? new Directive(dir, expression, rawKey, compiler, node)
        : utils.warn('invalid directive expression: ' + expression)
}

module.exports = Directive
},{"./directives":10,"./filters":18,"./utils":23}],8:[function(require,module,exports){
var toText = require('../utils').toText,
    slice = Array.prototype.slice

module.exports = {

    bind: function () {
        // a comment node means this is a binding for
        // {{{ inline unescaped html }}}
        if (this.el.nodeType === 8) {
            // hold nodes
            this.holder = document.createElement('div')
            this.nodes = []
        }
    },

    update: function (value) {
        value = toText(value)
        if (this.holder) {
            this.swap(value)
        } else {
            this.el.innerHTML = value
        }
    },

    swap: function (value) {
        var parent = this.el.parentNode,
            holder = this.holder,
            nodes = this.nodes,
            i = nodes.length, l
        while (i--) {
            parent.removeChild(nodes[i])
        }
        holder.innerHTML = value
        nodes = this.nodes = slice.call(holder.childNodes)
        for (i = 0, l = nodes.length; i < l; i++) {
            parent.insertBefore(nodes[i], this.el)
        }
    }
}
},{"../utils":23}],9:[function(require,module,exports){
var config = require('../config'),
    transition = require('../transition')

module.exports = {

    bind: function () {
        this.parent = this.el.parentNode
        this.ref = document.createComment(config.prefix + '-if-' + this.key)
        this.el.vue_ref = this.ref
    },

    update: function (value) {

        var el       = this.el

        if (!this.parent) { // the node was detached when bound
            if (!el.parentNode) {
                return
            } else {
                this.parent = el.parentNode
            }
        }

        // should always have this.parent if we reach here
        var parent   = this.parent,
            ref      = this.ref,
            compiler = this.compiler

        if (!value) {
            transition(el, -1, remove, compiler)
        } else {
            transition(el, 1, insert, compiler)
        }

        function remove () {
            if (!el.parentNode) return
            // insert the reference node
            var next = el.nextSibling
            if (next) {
                parent.insertBefore(ref, next)
            } else {
                parent.appendChild(ref)
            }
            parent.removeChild(el)
        }

        function insert () {
            if (el.parentNode) return
            parent.insertBefore(el, ref)
            parent.removeChild(ref)
        }
    },

    unbind: function () {
        this.el.vue_ref = null
    }
}
},{"../config":5,"../transition":22}],10:[function(require,module,exports){
var utils      = require('../utils'),
    config     = require('../config'),
    transition = require('../transition')

module.exports = {

    on        : require('./on'),
    repeat    : require('./repeat'),
    model     : require('./model'),
    'if'      : require('./if'),
    'with'    : require('./with'),
    html      : require('./html'),
    style     : require('./style'),

    attr: function (value) {
        if (value || value === 0) {
            this.el.setAttribute(this.arg, value)
        } else {
            this.el.removeAttribute(this.arg)
        }
    },

    text: function (value) {
        this.el.textContent = utils.toText(value)
    },

    show: function (value) {
        var el = this.el,
            target = value ? '' : 'none',
            change = function () {
                el.style.display = target
            }
        transition(el, value ? 1 : -1, change, this.compiler)
    },

    'class': function (value) {
        if (this.arg) {
            utils[value ? 'addClass' : 'removeClass'](this.el, this.arg)
        } else {
            if (this.lastVal) {
                utils.removeClass(this.el, this.lastVal)
            }
            if (value) {
                utils.addClass(this.el, value)
                this.lastVal = value
            }
        }
    },

    cloak: {
        bind: function () {
            var el = this.el
            this.compiler.observer.once('hook:ready', function () {
                el.removeAttribute(config.prefix + '-cloak')
            })
        }
    }

}
},{"../config":5,"../transition":22,"../utils":23,"./html":8,"./if":9,"./model":11,"./on":12,"./repeat":13,"./style":14,"./with":15}],11:[function(require,module,exports){
var utils = require('../utils'),
    isIE9 = navigator.userAgent.indexOf('MSIE 9.0') > 0

/**
 *  Returns an array of values from a multiple select
 */
function getMultipleSelectOptions (select) {
    return Array.prototype.filter
        .call(select.options, function (option) {
            return option.selected
        })
        .map(function (option) {
            return option.value || option.text
        })
}

module.exports = {

    bind: function () {

        var self = this,
            el   = self.el,
            type = el.type,
            tag  = el.tagName

        self.lock = false

        // determine what event to listen to
        self.event =
            (self.compiler.options.lazy ||
            tag === 'SELECT' ||
            type === 'checkbox' || type === 'radio')
                ? 'change'
                : 'input'

        // determine the attribute to change when updating
        self.attr = type === 'checkbox'
            ? 'checked'
            : (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA')
                ? 'value'
                : 'innerHTML'

        // select[multiple] support
        if(tag === 'SELECT' && el.hasAttribute('multiple')) {
            this.multi = true
        }

        var compositionLock = false
        self.cLock = function () {
            compositionLock = true
        }
        self.cUnlock = function () {
            compositionLock = false
        }
        el.addEventListener('compositionstart', this.cLock)
        el.addEventListener('compositionend', this.cUnlock)

        // attach listener
        self.set = self.filters
            ? function () {
                if (compositionLock) return
                // if this directive has filters
                // we need to let the vm.$set trigger
                // update() so filters are applied.
                // therefore we have to record cursor position
                // so that after vm.$set changes the input
                // value we can put the cursor back at where it is
                var cursorPos
                try { cursorPos = el.selectionStart } catch (e) {}

                self._set()

                // since updates are async
                // we need to reset cursor position async too
                utils.nextTick(function () {
                    if (cursorPos !== undefined) {
                        el.setSelectionRange(cursorPos, cursorPos)
                    }
                })
            }
            : function () {
                if (compositionLock) return
                // no filters, don't let it trigger update()
                self.lock = true

                self._set()

                utils.nextTick(function () {
                    self.lock = false
                })
            }
        el.addEventListener(self.event, self.set)

        // fix shit for IE9
        // since it doesn't fire input on backspace / del / cut
        if (isIE9) {
            self.onCut = function () {
                // cut event fires before the value actually changes
                utils.nextTick(function () {
                    self.set()
                })
            }
            self.onDel = function (e) {
                if (e.keyCode === 46 || e.keyCode === 8) {
                    self.set()
                }
            }
            el.addEventListener('cut', self.onCut)
            el.addEventListener('keyup', self.onDel)
        }
    },

    _set: function () {
        this.vm.$set(
            this.key, this.multi
                ? getMultipleSelectOptions(this.el)
                : this.el[this.attr]
        )
    },

    update: function (value) {
        /* jshint eqeqeq: false */
        if (this.lock) return
        var el = this.el
        if (el.tagName === 'SELECT') { // select dropdown
            el.selectedIndex = -1
            if(this.multi && Array.isArray(value)) {
                value.forEach(this.updateSelect, this)
            } else {
                this.updateSelect(value)
            }
        } else if (el.type === 'radio') { // radio button
            el.checked = value == el.value
        } else if (el.type === 'checkbox') { // checkbox
            el.checked = !!value
        } else {
            el[this.attr] = utils.toText(value)
        }
    },

    updateSelect: function (value) {
        /* jshint eqeqeq: false */
        // setting <select>'s value in IE9 doesn't work
        // we have to manually loop through the options
        var options = this.el.options,
            i = options.length
        while (i--) {
            if (options[i].value == value) {
                options[i].selected = true
                break
            }
        }
    },

    unbind: function () {
        var el = this.el
        el.removeEventListener(this.event, this.set)
        el.removeEventListener('compositionstart', this.cLock)
        el.removeEventListener('compositionend', this.cUnlock)
        if (isIE9) {
            el.removeEventListener('cut', this.onCut)
            el.removeEventListener('keyup', this.onDel)
        }
    }
}
},{"../utils":23}],12:[function(require,module,exports){
var utils = require('../utils')

function delegateCheck (el, root, identifier) {
    while (el && el !== root) {
        if (el[identifier]) return el
        el = el.parentNode
    }
}

module.exports = {

    isFn: true,

    bind: function () {
        if (this.compiler.repeat) {
            // attach an identifier to the el
            // so it can be matched during event delegation
            this.el[this.expression] = true
            // attach the owner viewmodel of this directive
            this.el.vue_viewmodel = this.vm
        }
    },

    update: function (handler) {
        this.reset()
        if (typeof handler !== 'function') {
            return utils.warn('Directive "on" expects a function value.')
        }

        var compiler = this.compiler,
            event    = this.arg,
            isExp    = this.binding.isExp,
            ownerVM  = this.binding.compiler.vm

        if (compiler.repeat &&
            // do not delegate if the repeat is combined with an extended VM
            !this.vm.constructor.super &&
            // blur and focus events do not bubble
            event !== 'blur' && event !== 'focus') {

            // for each blocks, delegate for better performance
            // focus and blur events dont bubble so exclude them
            var delegator  = compiler.delegator,
                identifier = this.expression,
                dHandler   = delegator.vue_dHandlers[identifier]

            if (dHandler) return

            // the following only gets run once for the entire each block
            dHandler = delegator.vue_dHandlers[identifier] = function (e) {
                var target = delegateCheck(e.target, delegator, identifier)
                if (target) {
                    e.el = target
                    e.targetVM = target.vue_viewmodel
                    handler.call(isExp ? e.targetVM : ownerVM, e)
                }
            }
            dHandler.event = event
            delegator.addEventListener(event, dHandler)

        } else {

            // a normal, single element handler
            var vm = this.vm
            this.handler = function (e) {
                e.el = e.currentTarget
                e.targetVM = vm
                handler.call(ownerVM, e)
            }
            this.el.addEventListener(event, this.handler)

        }
    },

    reset: function () {
        this.el.removeEventListener(this.arg, this.handler)
        this.handler = null
    },

    unbind: function () {
        this.reset()
        this.el.vue_viewmodel = null
    }
}
},{"../utils":23}],13:[function(require,module,exports){
var Observer   = require('../observer'),
    utils      = require('../utils'),
    config     = require('../config'),
    transition = require('../transition'),
    ViewModel // lazy def to avoid circular dependency

/**
 *  Mathods that perform precise DOM manipulation
 *  based on mutator method triggered
 */
var mutationHandlers = {

    push: function (m) {
        var i, l = m.args.length,
            base = this.collection.length - l
        for (i = 0; i < l; i++) {
            this.buildItem(m.args[i], base + i)
        }
    },

    pop: function () {
        var vm = this.vms.pop()
        if (vm) vm.$destroy()
    },

    unshift: function (m) {
        m.args.forEach(this.buildItem, this)
    },

    shift: function () {
        var vm = this.vms.shift()
        if (vm) vm.$destroy()
    },

    splice: function (m) {
        var i, l,
            index = m.args[0],
            removed = m.args[1],
            added = m.args.length - 2,
            removedVMs = this.vms.splice(index, removed)
        for (i = 0, l = removedVMs.length; i < l; i++) {
            removedVMs[i].$destroy()
        }
        for (i = 0; i < added; i++) {
            this.buildItem(m.args[i + 2], index + i)
        }
    },

    sort: function () {
        var vms = this.vms,
            col = this.collection,
            l = col.length,
            sorted = new Array(l),
            i, j, vm, data
        for (i = 0; i < l; i++) {
            data = col[i]
            for (j = 0; j < l; j++) {
                vm = vms[j]
                if (vm.$data === data) {
                    sorted[i] = vm
                    break
                }
            }
        }
        for (i = 0; i < l; i++) {
            this.container.insertBefore(sorted[i].$el, this.ref)
        }
        this.vms = sorted
    },

    reverse: function () {
        var vms = this.vms
        vms.reverse()
        for (var i = 0, l = vms.length; i < l; i++) {
            this.container.insertBefore(vms[i].$el, this.ref)
        }
    }
}

module.exports = {

    bind: function () {

        var el   = this.el,
            ctn  = this.container = el.parentNode

        // extract child VM information, if any
        ViewModel = ViewModel || require('../viewmodel')
        this.Ctor = this.Ctor || ViewModel
        // extract transition information
        this.hasTrans = el.hasAttribute(config.attrs.transition)
        // extract child Id, if any
        this.childId = utils.attr(el, 'ref')

        // create a comment node as a reference node for DOM insertions
        this.ref = document.createComment(config.prefix + '-repeat-' + this.key)
        ctn.insertBefore(this.ref, el)
        ctn.removeChild(el)

        this.initiated = false
        this.collection = null
        this.vms = null

        var self = this
        this.mutationListener = function (path, arr, mutation) {
            var method = mutation.method
            mutationHandlers[method].call(self, mutation)
            if (method !== 'push' && method !== 'pop') {
                var i = arr.length
                while (i--) {
                    arr[i].$index = i
                }
            }
            if (method === 'push' || method === 'unshift' || method === 'splice') {
                self.changed()
            }
        }

    },

    update: function (collection, init) {
        
        if (collection === this.collection) return

        this.reset()
        // attach an object to container to hold handlers
        this.container.vue_dHandlers = utils.hash()
        // if initiating with an empty collection, we need to
        // force a compile so that we get all the bindings for
        // dependency extraction.
        if (!this.initiated && (!collection || !collection.length)) {
            this.buildItem()
            this.initiated = true
        }
        collection = this.collection = collection || []
        this.vms = []
        if (this.childId) {
            this.vm.$[this.childId] = this.vms
        }

        // listen for collection mutation events
        // the collection has been augmented during Binding.set()
        if (!collection.__observer__) Observer.watchArray(collection)
        collection.__observer__.on('mutate', this.mutationListener)

        // create child-vms and append to DOM
        if (collection.length) {
            collection.forEach(this.buildItem, this)
            if (!init) this.changed()
        }
    },

    /**
     *  Notify parent compiler that new items
     *  have been added to the collection, it needs
     *  to re-calculate computed property dependencies.
     *  Batched to ensure it's called only once every event loop.
     */
    changed: function () {
        if (this.queued) return
        this.queued = true
        var self = this
        setTimeout(function () {
            if (!self.compiler) return
            self.compiler.parseDeps()
            self.queued = false
        }, 0)
    },

    /**
     *  Create a new child VM from a data object
     *  passing along compiler options indicating this
     *  is a v-repeat item.
     */
    buildItem: function (data, index) {

        var el  = this.el.cloneNode(true),
            ctn = this.container,
            vms = this.vms,
            col = this.collection,
            ref, item, primitive

        // append node into DOM first
        // so v-if can get access to parentNode
        if (data) {
            ref = vms.length > index
                ? vms[index].$el
                : this.ref
            // make sure it works with v-if
            if (!ref.parentNode) ref = ref.vue_ref
            // process transition info before appending
            el.vue_trans = utils.attr(el, 'transition', true)
            transition(el, 1, function () {
                ctn.insertBefore(el, ref)
            }, this.compiler)
            // wrap primitive element in an object
            if (utils.typeOf(data) !== 'Object') {
                primitive = true
                data = { value: data }
            }
        }

        item = new this.Ctor({
            el: el,
            data: data,
            compilerOptions: {
                repeat: true,
                repeatIndex: index,
                parentCompiler: this.compiler,
                delegator: ctn
            }
        })

        if (!data) {
            // this is a forced compile for an empty collection.
            // let's remove it...
            item.$destroy()
        } else {
            vms.splice(index, 0, item)
            // for primitive values, listen for value change
            if (primitive) {
                data.__observer__.on('set', function (key, val) {
                    if (key === 'value') {
                        col[item.$index] = val
                    }
                })
            }
        }
    },

    reset: function () {
        if (this.childId) {
            delete this.vm.$[this.childId]
        }
        if (this.collection) {
            this.collection.__observer__.off('mutate', this.mutationListener)
            var i = this.vms.length
            while (i--) {
                this.vms[i].$destroy()
            }
        }
        var ctn = this.container,
            handlers = ctn.vue_dHandlers
        for (var key in handlers) {
            ctn.removeEventListener(handlers[key].event, handlers[key])
        }
        ctn.vue_dHandlers = null
    },

    unbind: function () {
        this.reset()
    }
}
},{"../config":5,"../observer":20,"../transition":22,"../utils":23,"../viewmodel":24}],14:[function(require,module,exports){
var camelRE = /-([a-z])/g,
    prefixes = ['webkit', 'moz', 'ms']

function camelReplacer (m) {
    return m[1].toUpperCase()
}

module.exports = {

    bind: function () {
        var prop = this.arg,
            first = prop.charAt(0)
        if (first === '$') {
            // properties that start with $ will be auto-prefixed
            prop = prop.slice(1)
            this.prefixed = true
        } else if (first === '-') {
            // normal starting hyphens should not be converted
            prop = prop.slice(1)
        }
        this.prop = prop.replace(camelRE, camelReplacer)
    },

    update: function (value) {
        var prop = this.prop
        this.el.style[prop] = value
        if (this.prefixed) {
            prop = prop.charAt(0).toUpperCase() + prop.slice(1)
            var i = prefixes.length
            while (i--) {
                this.el.style[prefixes[i] + prop] = value
            }
        }
    }

}
},{}],15:[function(require,module,exports){
var ViewModel

module.exports = {

    bind: function () {
        if (this.isEmpty) {
            this.build()
        }
    },

    update: function (value) {
        if (!this.component) {
            this.build(value)
        } else {
            this.component.$data = value
        }
    },

    build: function (value) {
        ViewModel = ViewModel || require('../viewmodel')
        var Ctor = this.Ctor || ViewModel
        this.component = new Ctor({
            el: this.el,
            data: value,
            compilerOptions: {
                parentCompiler: this.compiler
            }
        })
    },

    unbind: function () {
        this.component.$destroy()
    }

}
},{"../viewmodel":24}],16:[function(require,module,exports){
// shiv to make this work for Component, Browserify and Node at the same time.
var Emitter,
    componentEmitter = 'emitter'

try {
    // Requiring without a string literal will make browserify
    // unable to parse the dependency, thus preventing it from
    // stopping the compilation after a failed lookup.
    Emitter = require(componentEmitter)
} catch (e) {
    Emitter = require('events').EventEmitter
    Emitter.prototype.off = function () {
        var method = arguments.length > 1
            ? this.removeListener
            : this.removeAllListeners
        return method.apply(this, arguments)
    }
}

module.exports = Emitter
},{"events":1}],17:[function(require,module,exports){
var utils           = require('./utils'),
    stringSaveRE    = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,
    stringRestoreRE = /"(\d+)"/g,
    constructorRE   = new RegExp('constructor'.split('').join('[\'"+, ]*')),
    unicodeRE       = /\\u\d\d\d\d/

// Variable extraction scooped from https://github.com/RubyLouvre/avalon

var KEYWORDS =
        // keywords
        'break,case,catch,continue,debugger,default,delete,do,else,false' +
        ',finally,for,function,if,in,instanceof,new,null,return,switch,this' +
        ',throw,true,try,typeof,var,void,while,with,undefined' +
        // reserved
        ',abstract,boolean,byte,char,class,const,double,enum,export,extends' +
        ',final,float,goto,implements,import,int,interface,long,native' +
        ',package,private,protected,public,short,static,super,synchronized' +
        ',throws,transient,volatile' +
        // ECMA 5 - use strict
        ',arguments,let,yield' +
        // allow using Math in expressions
        ',Math',
        
    KEYWORDS_RE = new RegExp(["\\b" + KEYWORDS.replace(/,/g, '\\b|\\b') + "\\b"].join('|'), 'g'),
    REMOVE_RE   = /\/\*(?:.|\n)*?\*\/|\/\/[^\n]*\n|\/\/[^\n]*$|'[^']*'|"[^"]*"|[\s\t\n]*\.[\s\t\n]*[$\w\.]+/g,
    SPLIT_RE    = /[^\w$]+/g,
    NUMBER_RE   = /\b\d[^,]*/g,
    BOUNDARY_RE = /^,+|,+$/g

/**
 *  Strip top level variable names from a snippet of JS expression
 */
function getVariables (code) {
    code = code
        .replace(REMOVE_RE, '')
        .replace(SPLIT_RE, ',')
        .replace(KEYWORDS_RE, '')
        .replace(NUMBER_RE, '')
        .replace(BOUNDARY_RE, '')
    return code
        ? code.split(/,+/)
        : []
}

/**
 *  A given path could potentially exist not on the
 *  current compiler, but up in the parent chain somewhere.
 *  This function generates an access relationship string
 *  that can be used in the getter function by walking up
 *  the parent chain to check for key existence.
 *
 *  It stops at top parent if no vm in the chain has the
 *  key. It then creates any missing bindings on the
 *  final resolved vm.
 */
function getRel (path, compiler) {
    var rel  = '',
        dist = 0,
        self = compiler
    while (compiler) {
        if (compiler.hasKey(path)) {
            break
        } else {
            compiler = compiler.parentCompiler
            dist++
        }
    }
    if (compiler) {
        while (dist--) {
            rel += '$parent.'
        }
        if (!compiler.bindings[path] && path.charAt(0) !== '$') {
            compiler.createBinding(path)
        }
    } else {
        self.createBinding(path)
    }
    return rel
}

/**
 *  Create a function from a string...
 *  this looks like evil magic but since all variables are limited
 *  to the VM's data it's actually properly sandboxed
 */
function makeGetter (exp, raw) {
    /* jshint evil: true */
    var fn
    try {
        fn = new Function(exp)
    } catch (e) {
        utils.warn('Invalid expression: ' + raw)
    }
    return fn
}

/**
 *  Escape a leading dollar sign for regex construction
 */
function escapeDollar (v) {
    return v.charAt(0) === '$'
        ? '\\' + v
        : v
}

module.exports = {

    /**
     *  Parse and return an anonymous computed property getter function
     *  from an arbitrary expression, together with a list of paths to be
     *  created as bindings.
     */
    parse: function (exp, compiler) {
        // unicode and 'constructor' are not allowed for XSS security.
        if (unicodeRE.test(exp) || constructorRE.test(exp)) {
            utils.warn('Unsafe expression: ' + exp)
            return function () {}
        }
        // extract variable names
        var vars = getVariables(exp)
        if (!vars.length) {
            return makeGetter('return ' + exp, exp)
        }
        vars = utils.unique(vars)
        var accessors = '',
            has       = utils.hash(),
            strings   = [],
            // construct a regex to extract all valid variable paths
            // ones that begin with "$" are particularly tricky
            // because we can't use \b for them
            pathRE = new RegExp(
                "[^$\\w\\.](" +
                vars.map(escapeDollar).join('|') +
                ")[$\\w\\.]*\\b", 'g'
            ),
            body = ('return ' + exp)
                .replace(stringSaveRE, saveStrings)
                .replace(pathRE, replacePath)
                .replace(stringRestoreRE, restoreStrings)
        body = accessors + body

        function saveStrings (str) {
            var i = strings.length
            strings[i] = str
            return '"' + i + '"'
        }

        function replacePath (path) {
            // keep track of the first char
            var c = path.charAt(0)
            path = path.slice(1)
            var val = 'this.' + getRel(path, compiler) + path
            if (!has[path]) {
                accessors += val + ';'
                has[path] = 1
            }
            // don't forget to put that first char back
            return c + val
        }

        function restoreStrings (str, i) {
            return strings[i]
        }

        return makeGetter(body, exp)
    }
}
},{"./utils":23}],18:[function(require,module,exports){
var keyCodes = {
    enter    : 13,
    tab      : 9,
    'delete' : 46,
    up       : 38,
    left     : 37,
    right    : 39,
    down     : 40,
    esc      : 27
}

module.exports = {

    /**
     *  'abc' => 'Abc'
     */
    capitalize: function (value) {
        if (!value && value !== 0) return ''
        value = value.toString()
        return value.charAt(0).toUpperCase() + value.slice(1)
    },

    /**
     *  'abc' => 'ABC'
     */
    uppercase: function (value) {
        return (value || value === 0)
            ? value.toString().toUpperCase()
            : ''
    },

    /**
     *  'AbC' => 'abc'
     */
    lowercase: function (value) {
        return (value || value === 0)
            ? value.toString().toLowerCase()
            : ''
    },

    /**
     *  12345 => $12,345.00
     */
    currency: function (value, args) {
        if (!value && value !== 0) return ''
        var sign = (args && args[0]) || '$',
            s = Math.floor(value).toString(),
            i = s.length % 3,
            h = i > 0 ? (s.slice(0, i) + (s.length > 3 ? ',' : '')) : '',
            f = '.' + value.toFixed(2).slice(-2)
        return sign + h + s.slice(i).replace(/(\d{3})(?=\d)/g, '$1,') + f
    },

    /**
     *  args: an array of strings corresponding to
     *  the single, double, triple ... forms of the word to
     *  be pluralized. When the number to be pluralized
     *  exceeds the length of the args, it will use the last
     *  entry in the array.
     *
     *  e.g. ['single', 'double', 'triple', 'multiple']
     */
    pluralize: function (value, args) {
        return args.length > 1
            ? (args[value - 1] || args[args.length - 1])
            : (args[value - 1] || args[0] + 's')
    },

    /**
     *  A special filter that takes a handler function,
     *  wraps it so it only gets triggered on specific keypresses.
     */
    key: function (handler, args) {
        if (!handler) return
        var code = keyCodes[args[0]]
        if (!code) {
            code = parseInt(args[0], 10)
        }
        return function (e) {
            if (e.keyCode === code) {
                handler.call(this, e)
            }
        }
    }
}
},{}],19:[function(require,module,exports){
var config      = require('./config'),
    ViewModel   = require('./viewmodel'),
    directives  = require('./directives'),
    filters     = require('./filters'),
    utils       = require('./utils')

/**
 *  Set config options
 */
ViewModel.config = function (opts, val) {
    if (typeof opts === 'string') {
        if (val === undefined) {
            return config[opts]
        } else {
            config[opts] = val
        }
    } else {
        utils.extend(config, opts)
    }
    return this
}

/**
 *  Allows user to register/retrieve a directive definition
 */
ViewModel.directive = function (id, fn) {
    if (!fn) return directives[id]
    directives[id] = fn
    return this
}

/**
 *  Allows user to register/retrieve a filter function
 */
ViewModel.filter = function (id, fn) {
    if (!fn) return filters[id]
    filters[id] = fn
    return this
}

/**
 *  Allows user to register/retrieve a ViewModel constructor
 */
ViewModel.component = function (id, Ctor) {
    if (!Ctor) return utils.components[id]
    utils.components[id] = utils.toConstructor(Ctor)
    return this
}

/**
 *  Allows user to register/retrieve a template partial
 */
ViewModel.partial = function (id, partial) {
    if (!partial) return utils.partials[id]
    utils.partials[id] = utils.toFragment(partial)
    return this
}

/**
 *  Allows user to register/retrieve a transition definition object
 */
ViewModel.transition = function (id, transition) {
    if (!transition) return utils.transitions[id]
    utils.transitions[id] = transition
    return this
}

/**
 *  Expose internal modules for plugins
 */
ViewModel.require = function (path) {
    return require('./' + path)
}

/**
 *  Expose an interface for plugins
 */
ViewModel.use = function (plugin) {
    if (typeof plugin === 'string') {
        try {
            plugin = require(plugin)
        } catch (e) {
            return utils.warn('Cannot find plugin: ' + plugin)
        }
    }
    if (typeof plugin === 'function') {
        plugin(ViewModel)
    } else if (plugin.install) {
        plugin.install(ViewModel)
    }
}

ViewModel.extend = extend
ViewModel.nextTick = utils.nextTick

/**
 *  Expose the main ViewModel class
 *  and add extend method
 */
function extend (options) {

    var ParentVM = this

    // inherit options
    options = inheritOptions(options, ParentVM.options, true)
    utils.processOptions(options)

    var ExtendedVM = function (opts, asParent) {
        if (!asParent) {
            opts = inheritOptions(opts, options, true)
        }
        ParentVM.call(this, opts, true)
    }

    // inherit prototype props
    var proto = ExtendedVM.prototype = Object.create(ParentVM.prototype)
    utils.defProtected(proto, 'constructor', ExtendedVM)

    // copy prototype props
    var methods = options.methods
    if (methods) {
        for (var key in methods) {
            if (
                !(key in ViewModel.prototype) &&
                typeof methods[key] === 'function'
            ) {
                proto[key] = methods[key]
            }
        }
    }

    // allow extended VM to be further extended
    ExtendedVM.extend = extend
    ExtendedVM.super = ParentVM
    ExtendedVM.options = options
    return ExtendedVM
}

/**
 *  Inherit options
 *
 *  For options such as `data`, `vms`, `directives`, 'partials',
 *  they should be further extended. However extending should only
 *  be done at top level.
 *  
 *  `proto` is an exception because it's handled directly on the
 *  prototype.
 *
 *  `el` is an exception because it's not allowed as an
 *  extension option, but only as an instance option.
 */
function inheritOptions (child, parent, topLevel) {
    child = child || utils.hash()
    if (!parent) return child
    for (var key in parent) {
        if (key === 'el' || key === 'methods') continue
        var val = child[key],
            parentVal = parent[key],
            type = utils.typeOf(val)
        if (topLevel && type === 'Function' && parentVal) {
            // merge hook functions into an array
            child[key] = [val]
            if (Array.isArray(parentVal)) {
                child[key] = child[key].concat(parentVal)
            } else {
                child[key].push(parentVal)
            }
        } else if (topLevel && type === 'Object') {
            // merge toplevel object options
            inheritOptions(val, parentVal)
        } else if (val === undefined) {
            // inherit if child doesn't override
            child[key] = parentVal
        }
    }
    return child
}

module.exports = ViewModel
},{"./config":5,"./directives":10,"./filters":18,"./utils":23,"./viewmodel":24}],20:[function(require,module,exports){
/* jshint proto:true */

var Emitter  = require('./emitter'),
    utils    = require('./utils'),

    // cache methods
    typeOf   = utils.typeOf,
    def      = utils.defProtected,
    slice    = Array.prototype.slice,

    // types
    OBJECT   = 'Object',
    ARRAY    = 'Array',

    // Array mutation methods to wrap
    methods  = ['push','pop','shift','unshift','splice','sort','reverse'],

    // fix for IE + __proto__ problem
    // define methods as inenumerable if __proto__ is present,
    // otherwise enumerable so we can loop through and manually
    // attach to array instances
    hasProto = ({}).__proto__,

    // lazy load
    ViewModel

// The proxy prototype to replace the __proto__ of
// an observed array
var ArrayProxy = Object.create(Array.prototype)

// Define mutation interceptors so we can emit the mutation info
methods.forEach(function (method) {
    def(ArrayProxy, method, function () {
        var result = Array.prototype[method].apply(this, arguments)
        this.__observer__.emit('mutate', null, this, {
            method: method,
            args: slice.call(arguments),
            result: result
        })
        return result
    }, !hasProto)
})

/**
 *  Convenience method to remove an element in an Array
 *  This will be attached to observed Array instances
 */
function removeElement (index) {
    if (typeof index === 'function') {
        var i = this.length,
            removed = []
        while (i--) {
            if (index(this[i])) {
                removed.push(this.splice(i, 1)[0])
            }
        }
        return removed.reverse()
    } else {
        if (typeof index !== 'number') {
            index = this.indexOf(index)
        }
        if (index > -1) {
            return this.splice(index, 1)[0]
        }
    }
}

/**
 *  Convenience method to replace an element in an Array
 *  This will be attached to observed Array instances
 */
function replaceElement (index, data) {
    if (typeof index === 'function') {
        var i = this.length,
            replaced = [],
            replacer
        while (i--) {
            replacer = index(this[i])
            if (replacer !== undefined) {
                replaced.push(this.splice(i, 1, replacer)[0])
            }
        }
        return replaced.reverse()
    } else {
        if (typeof index !== 'number') {
            index = this.indexOf(index)
        }
        if (index > -1) {
            return this.splice(index, 1, data)[0]
        }
    }
}

// Augment the ArrayProxy with convenience methods
def(ArrayProxy, 'remove', removeElement, !hasProto)
def(ArrayProxy, 'set', replaceElement, !hasProto)
def(ArrayProxy, 'replace', replaceElement, !hasProto)

/**
 *  Watch an Object, recursive.
 */
function watchObject (obj) {
    for (var key in obj) {
        convert(obj, key)
    }
}

/**
 *  Watch an Array, overload mutation methods
 *  and add augmentations by intercepting the prototype chain
 */
function watchArray (arr) {
    var observer = arr.__observer__
    if (!observer) {
        observer = new Emitter()
        def(arr, '__observer__', observer)
    }
    if (hasProto) {
        arr.__proto__ = ArrayProxy
    } else {
        for (var key in ArrayProxy) {
            def(arr, key, ArrayProxy[key])
        }
    }
}

/**
 *  Define accessors for a property on an Object
 *  so it emits get/set events.
 *  Then watch the value itself.
 */
function convert (obj, key) {
    var keyPrefix = key.charAt(0)
    if ((keyPrefix === '$' || keyPrefix === '_') && key !== '$index') {
        return
    }
    // emit set on bind
    // this means when an object is observed it will emit
    // a first batch of set events.
    var observer = obj.__observer__,
        values   = observer.values,
        val      = values[key] = obj[key]
    observer.emit('set', key, val)
    if (Array.isArray(val)) {
        observer.emit('set', key + '.length', val.length)
    }
    Object.defineProperty(obj, key, {
        get: function () {
            var value = values[key]
            // only emit get on tip values
            if (pub.shouldGet && typeOf(value) !== OBJECT) {
                observer.emit('get', key)
            }
            return value
        },
        set: function (newVal) {
            var oldVal = values[key]
            unobserve(oldVal, key, observer)
            values[key] = newVal
            copyPaths(newVal, oldVal)
            // an immediate property should notify its parent
            // to emit set for itself too
            observer.emit('set', key, newVal, true)
            observe(newVal, key, observer)
        }
    })
    observe(val, key, observer)
}

/**
 *  Check if a value is watchable
 */
function isWatchable (obj) {
    ViewModel = ViewModel || require('./viewmodel')
    var type = typeOf(obj)
    return (type === OBJECT || type === ARRAY) && !(obj instanceof ViewModel)
}

/**
 *  When a value that is already converted is
 *  observed again by another observer, we can skip
 *  the watch conversion and simply emit set event for
 *  all of its properties.
 */
function emitSet (obj) {
    var type = typeOf(obj),
        emitter = obj && obj.__observer__
    if (type === ARRAY) {
        emitter.emit('set', 'length', obj.length)
    } else if (type === OBJECT) {
        var key, val
        for (key in obj) {
            val = obj[key]
            emitter.emit('set', key, val)
            emitSet(val)
        }
    }
}

/**
 *  Make sure all the paths in an old object exists
 *  in a new object.
 *  So when an object changes, all missing keys will
 *  emit a set event with undefined value.
 */
function copyPaths (newObj, oldObj) {
    if (typeOf(oldObj) !== OBJECT || typeOf(newObj) !== OBJECT) {
        return
    }
    var path, type, oldVal, newVal
    for (path in oldObj) {
        if (!(path in newObj)) {
            oldVal = oldObj[path]
            type = typeOf(oldVal)
            if (type === OBJECT) {
                newVal = newObj[path] = {}
                copyPaths(newVal, oldVal)
            } else if (type === ARRAY) {
                newObj[path] = []
            } else {
                newObj[path] = undefined
            }
        }
    }
}

/**
 *  walk along a path and make sure it can be accessed
 *  and enumerated in that object
 */
function ensurePath (obj, key) {
    var path = key.split('.'), sec
    for (var i = 0, d = path.length - 1; i < d; i++) {
        sec = path[i]
        if (!obj[sec]) {
            obj[sec] = {}
            if (obj.__observer__) convert(obj, sec)
        }
        obj = obj[sec]
    }
    if (typeOf(obj) === OBJECT) {
        sec = path[i]
        if (!(sec in obj)) {
            obj[sec] = undefined
            if (obj.__observer__) convert(obj, sec)
        }
    }
}

/**
 *  Observe an object with a given path,
 *  and proxy get/set/mutate events to the provided observer.
 */
function observe (obj, rawPath, parentOb) {

    if (!isWatchable(obj)) return

    var path = rawPath ? rawPath + '.' : '',
        alreadyConverted = !!obj.__observer__,
        childOb

    if (!alreadyConverted) {
        def(obj, '__observer__', new Emitter())
    }

    childOb = obj.__observer__
    childOb.values = childOb.values || utils.hash()

    // setup proxy listeners on the parent observer.
    // we need to keep reference to them so that they
    // can be removed when the object is un-observed.
    parentOb.proxies = parentOb.proxies || {}
    var proxies = parentOb.proxies[path] = {
        get: function (key) {
            parentOb.emit('get', path + key)
        },
        set: function (key, val, propagate) {
            parentOb.emit('set', path + key, val)
            // also notify observer that the object itself changed
            // but only do so when it's a immediate property. this
            // avoids duplicate event firing.
            if (rawPath && propagate) {
                parentOb.emit('set', rawPath, obj, true)
            }
        },
        mutate: function (key, val, mutation) {
            // if the Array is a root value
            // the key will be null
            var fixedPath = key ? path + key : rawPath
            parentOb.emit('mutate', fixedPath, val, mutation)
            // also emit set for Array's length when it mutates
            var m = mutation.method
            if (m !== 'sort' && m !== 'reverse') {
                parentOb.emit('set', fixedPath + '.length', val.length)
            }
        }
    }

    // attach the listeners to the child observer.
    // now all the events will propagate upwards.
    childOb
        .on('get', proxies.get)
        .on('set', proxies.set)
        .on('mutate', proxies.mutate)

    if (alreadyConverted) {
        // for objects that have already been converted,
        // emit set events for everything inside
        emitSet(obj)
    } else {
        var type = typeOf(obj)
        if (type === OBJECT) {
            watchObject(obj)
        } else if (type === ARRAY) {
            watchArray(obj)
        }
    }
}

/**
 *  Cancel observation, turn off the listeners.
 */
function unobserve (obj, path, observer) {

    if (!obj || !obj.__observer__) return

    path = path ? path + '.' : ''
    var proxies = observer.proxies[path]
    if (!proxies) return

    // turn off listeners
    obj.__observer__
        .off('get', proxies.get)
        .off('set', proxies.set)
        .off('mutate', proxies.mutate)

    // remove reference
    observer.proxies[path] = null
}

var pub = module.exports = {

    // whether to emit get events
    // only enabled during dependency parsing
    shouldGet   : false,

    observe     : observe,
    unobserve   : unobserve,
    ensurePath  : ensurePath,
    convert     : convert,
    copyPaths   : copyPaths,
    watchArray  : watchArray
}
},{"./emitter":16,"./utils":23,"./viewmodel":24}],21:[function(require,module,exports){
var BINDING_RE = /{{{?([^{}]+?)}?}}/,
    TRIPLE_RE = /{{{[^{}]+}}}/

/**
 *  Parse a piece of text, return an array of tokens
 */
function parse (text) {
    if (!BINDING_RE.test(text)) return null
    var m, i, token, tokens = []
    /* jshint boss: true */
    while (m = text.match(BINDING_RE)) {
        i = m.index
        if (i > 0) tokens.push(text.slice(0, i))
        token = { key: m[1].trim() }
        if (TRIPLE_RE.test(m[0])) token.html = true
        tokens.push(token)
        text = text.slice(i + m[0].length)
    }
    if (text.length) tokens.push(text)
    return tokens
}

/**
 *  Parse an attribute value with possible interpolation tags
 *  return a Directive-friendly expression
 */
function parseAttr (attr) {
    var tokens = parse(attr)
    if (!tokens) return null
    var res = [], token
    for (var i = 0, l = tokens.length; i < l; i++) {
        token = tokens[i]
        res.push(token.key || ('"' + token + '"'))
    }
    return res.join('+')
}

exports.parse = parse
exports.parseAttr = parseAttr
},{}],22:[function(require,module,exports){
var endEvent   = sniffTransitionEndEvent(),
    config     = require('./config'),
    // exit codes for testing
    codes = {
        CSS_E     : 1,
        CSS_L     : 2,
        JS_E      : 3,
        JS_L      : 4,
        CSS_SKIP  : -1,
        JS_SKIP   : -2,
        JS_SKIP_E : -3,
        JS_SKIP_L : -4,
        INIT      : -5,
        SKIP      : -6
    }

/**
 *  stage:
 *    1 = enter
 *    2 = leave
 */
var transition = module.exports = function (el, stage, cb, compiler) {

    var changeState = function () {
        cb()
        compiler.execHook(stage > 0 ? 'attached' : 'detached')
    }

    if (compiler.init) {
        changeState()
        return codes.INIT
    }

    var transitionId = el.vue_trans

    if (transitionId) {
        return applyTransitionFunctions(
            el,
            stage,
            changeState,
            transitionId,
            compiler
        )
    } else if (transitionId === '') {
        return applyTransitionClass(
            el,
            stage,
            changeState
        )
    } else {
        changeState()
        return codes.SKIP
    }

}

transition.codes = codes

/**
 *  Togggle a CSS class to trigger transition
 */
function applyTransitionClass (el, stage, changeState) {

    if (!endEvent) {
        changeState()
        return codes.CSS_SKIP
    }

    // if the browser supports transition,
    // it must have classList...
    var classList         = el.classList,
        lastLeaveCallback = el.vue_trans_cb

    if (stage > 0) { // enter

        // cancel unfinished leave transition
        if (lastLeaveCallback) {
            el.removeEventListener(endEvent, lastLeaveCallback)
            el.vue_trans_cb = null
        }

        // set to hidden state before appending
        classList.add(config.enterClass)
        // append
        changeState()
        // force a layout so transition can be triggered
        /* jshint unused: false */
        var forceLayout = el.clientHeight
        // trigger transition
        classList.remove(config.enterClass)
        return codes.CSS_E

    } else { // leave

        // trigger hide transition
        classList.add(config.leaveClass)
        var onEnd = function (e) {
            if (e.target === el) {
                el.removeEventListener(endEvent, onEnd)
                el.vue_trans_cb = null
                // actually remove node here
                changeState()
                classList.remove(config.leaveClass)
            }
        }
        // attach transition end listener
        el.addEventListener(endEvent, onEnd)
        el.vue_trans_cb = onEnd
        return codes.CSS_L
        
    }

}

function applyTransitionFunctions (el, stage, changeState, functionId, compiler) {

    var funcs = compiler.getOption('transitions', functionId)
    if (!funcs) {
        changeState()
        return codes.JS_SKIP
    }

    var enter = funcs.enter,
        leave = funcs.leave

    if (stage > 0) { // enter
        if (typeof enter !== 'function') {
            changeState()
            return codes.JS_SKIP_E
        }
        enter(el, changeState)
        return codes.JS_E
    } else { // leave
        if (typeof leave !== 'function') {
            changeState()
            return codes.JS_SKIP_L
        }
        leave(el, changeState)
        return codes.JS_L
    }

}

/**
 *  Sniff proper transition end event name
 */
function sniffTransitionEndEvent () {
    var el = document.createElement('vue'),
        defaultEvent = 'transitionend',
        events = {
            'transition'       : defaultEvent,
            'mozTransition'    : defaultEvent,
            'webkitTransition' : 'webkitTransitionEnd'
        }
    for (var name in events) {
        if (el.style[name] !== undefined) {
            return events[name]
        }
    }
}
},{"./config":5}],23:[function(require,module,exports){
var config    = require('./config'),
    attrs     = config.attrs,
    toString  = Object.prototype.toString,
    join      = Array.prototype.join,
    console   = window.console,

    hasClassList = 'classList' in document.documentElement,
    ViewModel // late def

var defer =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.setTimeout

/**
 *  Create a prototype-less object
 *  which is a better hash/map
 */
function makeHash () {
    return Object.create(null)
}

var utils = module.exports = {

    hash: makeHash,

    // global storage for user-registered
    // vms, partials and transitions
    components  : makeHash(),
    partials    : makeHash(),
    transitions : makeHash(),

    /**
     *  get an attribute and remove it.
     */
    attr: function (el, type, noRemove) {
        var attr = attrs[type],
            val = el.getAttribute(attr)
        if (!noRemove && val !== null) el.removeAttribute(attr)
        return val
    },

    /**
     *  Define an ienumerable property
     *  This avoids it being included in JSON.stringify
     *  or for...in loops.
     */
    defProtected: function (obj, key, val, enumerable, configurable) {
        if (obj.hasOwnProperty(key)) return
        Object.defineProperty(obj, key, {
            value        : val,
            enumerable   : !!enumerable,
            configurable : !!configurable
        })
    },

    /**
     *  Accurate type check
     *  internal use only, so no need to check for NaN
     */
    typeOf: function (obj) {
        return toString.call(obj).slice(8, -1)
    },

    /**
     *  Most simple bind
     *  enough for the usecase and fast than native bind()
     */
    bind: function (fn, ctx) {
        return function (arg) {
            return fn.call(ctx, arg)
        }
    },

    /**
     *  Make sure only strings, booleans, numbers and
     *  objects are output to html. otherwise, ouput empty string.
     */
    toText: function (value) {
        /* jshint eqeqeq: false */
        var type = typeof value
        return (type === 'string' ||
            type === 'boolean' ||
            (type === 'number' && value == value)) // deal with NaN
                ? value
                : type === 'object' && value !== null
                    ? JSON.stringify(value)
                    : ''
    },

    /**
     *  simple extend
     */
    extend: function (obj, ext, protective) {
        for (var key in ext) {
            if (protective && obj[key]) continue
            obj[key] = ext[key]
        }
    },

    /**
     *  filter an array with duplicates into uniques
     */
    unique: function (arr) {
        var hash = utils.hash(),
            i = arr.length,
            key, res = []
        while (i--) {
            key = arr[i]
            if (hash[key]) continue
            hash[key] = 1
            res.push(key)
        }
        return res
    },

    /**
     *  Convert a string template to a dom fragment
     */
    toFragment: function (template) {
        if (typeof template !== 'string') {
            return template
        }
        if (template.charAt(0) === '#') {
            var templateNode = document.getElementById(template.slice(1))
            if (!templateNode) return
            template = templateNode.innerHTML
        }
        var node = document.createElement('div'),
            frag = document.createDocumentFragment(),
            child
        node.innerHTML = template.trim()
        /* jshint boss: true */
        while (child = node.firstChild) {
            if (node.nodeType === 1) {
                frag.appendChild(child)
            }
        }
        return frag
    },

    /**
     *  Convert the object to a ViewModel constructor
     *  if it is not already one
     */
    toConstructor: function (obj) {
        ViewModel = ViewModel || require('./viewmodel')
        return utils.typeOf(obj) === 'Object'
            ? ViewModel.extend(obj)
            : typeof obj === 'function'
                ? obj
                : null
    },

    /**
     *  convert certain option values to the desired format.
     */
    processOptions: function (options) {
        var components = options.components,
            partials   = options.partials,
            template   = options.template,
            key
        if (components) {
            for (key in components) {
                components[key] = utils.toConstructor(components[key])
            }
        }
        if (partials) {
            for (key in partials) {
                partials[key] = utils.toFragment(partials[key])
            }
        }
        if (template) {
            options.template = utils.toFragment(template)
        }
    },

    /**
     *  log for debugging
     */
    log: function () {
        if (config.debug && console) {
            console.log(join.call(arguments, ' '))
        }
    },
    
    /**
     *  warnings, traces by default
     *  can be suppressed by `silent` option.
     */
    warn: function() {
        if (!config.silent && console) {
            console.warn(join.call(arguments, ' '))
            if (config.debug) {
                console.trace()
            }
        }
    },

    /**
     *  used to defer batch updates
     */
    nextTick: function (cb) {
        defer(cb, 0)
    },

    /**
     *  add class for IE9
     *  uses classList if available
     */
    addClass: function (el, cls) {
        if (hasClassList) {
            el.classList.add(cls)
        } else {
            var cur = ' ' + el.className + ' '
            if (cur.indexOf(' ' + cls + ' ') < 0) {
                el.className = (cur + cls).trim()
            }
        }
    },

    /**
     *  remove class for IE9
     */
    removeClass: function (el, cls) {
        if (hasClassList) {
            el.classList.remove(cls)
        } else {
            var cur = ' ' + el.className + ' ',
                tar = ' ' + cls + ' '
            while (cur.indexOf(tar) >= 0) {
                cur = cur.replace(tar, ' ')
            }
            el.className = cur.trim()
        }
    }
}
},{"./config":5,"./viewmodel":24}],24:[function(require,module,exports){
var Compiler   = require('./compiler'),
    utils      = require('./utils'),
    transition = require('./transition'),
    def        = utils.defProtected,
    nextTick   = utils.nextTick

/**
 *  ViewModel exposed to the user that holds data,
 *  computed properties, event handlers
 *  and a few reserved methods
 */
function ViewModel (options) {
    // just compile. options are passed directly to compiler
    new Compiler(this, options)
}

// All VM prototype methods are inenumerable
// so it can be stringified/looped through as raw data
var VMProto = ViewModel.prototype

/**
 *  Convenience function to set an actual nested value
 *  from a flat key string. Used in directives.
 */
def(VMProto, '$set', function (key, value) {
    var path = key.split('.'),
        obj = getTargetVM(this, path)
    if (!obj) return
    for (var d = 0, l = path.length - 1; d < l; d++) {
        obj = obj[path[d]]
    }
    obj[path[d]] = value
})

/**
 *  watch a key on the viewmodel for changes
 *  fire callback with new value
 */
def(VMProto, '$watch', function (key, callback) {
    var self = this
    function on () {
        var args = arguments
        utils.nextTick(function () {
            callback.apply(self, args)
        })
    }
    callback._fn = on
    self.$compiler.observer.on('change:' + key, on)
})

/**
 *  unwatch a key
 */
def(VMProto, '$unwatch', function (key, callback) {
    // workaround here
    // since the emitter module checks callback existence
    // by checking the length of arguments
    var args = ['change:' + key],
        ob = this.$compiler.observer
    if (callback) args.push(callback._fn)
    ob.off.apply(ob, args)
})

/**
 *  unbind everything, remove everything
 */
def(VMProto, '$destroy', function () {
    this.$compiler.destroy()
})

/**
 *  broadcast an event to all child VMs recursively.
 */
def(VMProto, '$broadcast', function () {
    var children = this.$compiler.childCompilers,
        i = children.length,
        child
    while (i--) {
        child = children[i]
        child.emitter.emit.apply(child.emitter, arguments)
        child.vm.$broadcast.apply(child.vm, arguments)
    }
})

/**
 *  emit an event that propagates all the way up to parent VMs.
 */
def(VMProto, '$dispatch', function () {
    var compiler = this.$compiler,
        emitter = compiler.emitter,
        parent = compiler.parentCompiler
    emitter.emit.apply(emitter, arguments)
    if (parent) {
        parent.vm.$dispatch.apply(parent.vm, arguments)
    }
})

/**
 *  delegate on/off/once to the compiler's emitter
 */
;['emit', 'on', 'off', 'once'].forEach(function (method) {
    def(VMProto, '$' + method, function () {
        var emitter = this.$compiler.emitter
        emitter[method].apply(emitter, arguments)
    })
})

// DOM convenience methods

def(VMProto, '$appendTo', function (target, cb) {
    target = query(target)
    var el = this.$el
    transition(el, 1, function () {
        target.appendChild(el)
        if (cb) nextTick(cb)
    }, this.$compiler)
})

def(VMProto, '$remove', function (cb) {
    var el = this.$el,
        parent = el.parentNode
    if (!parent) return
    transition(el, -1, function () {
        parent.removeChild(el)
        if (cb) nextTick(cb)
    }, this.$compiler)
})

def(VMProto, '$before', function (target, cb) {
    target = query(target)
    var el = this.$el,
        parent = target.parentNode
    if (!parent) return
    transition(el, 1, function () {
        parent.insertBefore(el, target)
        if (cb) nextTick(cb)
    }, this.$compiler)
})

def(VMProto, '$after', function (target, cb) {
    target = query(target)
    var el = this.$el,
        parent = target.parentNode,
        next = target.nextSibling
    if (!parent) return
    transition(el, 1, function () {
        if (next) {
            parent.insertBefore(el, next)
        } else {
            parent.appendChild(el)
        }
        if (cb) nextTick(cb)
    }, this.$compiler)
})

function query (el) {
    return typeof el === 'string'
        ? document.querySelector(el)
        : el
}

/**
 *  If a VM doesn't contain a path, go up the prototype chain
 *  to locate the ancestor that has it.
 */
function getTargetVM (vm, path) {
    var baseKey = path[0],
        binding = vm.$compiler.bindings[baseKey]
    return binding
        ? binding.compiler.vm
        : null
}

module.exports = ViewModel
},{"./compiler":4,"./transition":22,"./utils":23}],25:[function(require,module,exports){
console.log(require('./template.html'));

module.exports = {
	className : 'products',
	template : require('./template.html'),
	

    computed : {
        total : function(){
            return this.qty * this.price;
        }
    }
};
},{"./template.html":26}],26:[function(require,module,exports){
module.exports = "<h4>{{name}}</h4>\n<p>{{total}}</p>";

},{}],27:[function(require,module,exports){

var Vue = require('vue');

    var canvas = document.querySelector('canvas'),
        context = canvas.getContext('2d'),
        imgContext,
        $wrapper = document.getElementById('can-wrapper');

        $wrapper.style.height = window.innerHeight + 100 + 'px';
        $wrapper.style.width = window.innerWidth + 100 + 'px';

function blurBookBackground() {
    
    var image = new Image();

    canvas.width = window.innerWidth * 1.6;
    canvas.height = window.innerHeight * 1.6;

    image.addEventListener('load',function cb(){

        context.drawImage(this,100,180,600,600,0,0,window.innerWidth*1.6,window.innerWidth*1.6);
        this.removeEventListener('load',cb);
        imageContext = this;

    },false);

    image.src = 'images/gotye.jpg';

}

window.addEventListener('resize', function(){

    context.drawImage(imageContext,100,180,600,600,0,0,window.innerWidth*1.6,window.innerWidth*1.6);
    
}, false);

blurBookBackground();


var f = {
    foo : 'bar'
};

var o = {};

var key = 'foo';

Object.defineProperty(o,key, {
    get: function () { return f[key]; }, 
    set: function (x) { console.log('some shit changed via', key); f[key] = x; }
});

console.log(o.foo);

o.foo = 'stuff';

console.log(o.foo);

var container = new Vue({

    el: '#shopping-cart',

    components: {
        products: require('./components/products')
    },

    data: {
        products : [{
            name : 'Foo',
            qty : 4,
            price : 2.99
        },{
            name : 'Foo2',
            qty : 3,
            price : 1.99
        }]
    }
});

console.log( container.$ );
},{"./components/products":25,"vue":19}]},{},[27])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL2d1bHAtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL3Z1ZS9zcmMvYmF0Y2hlci5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy9iaW5kaW5nLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy92dWUvc3JjL2NvbXBpbGVyLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy92dWUvc3JjL2NvbmZpZy5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy9kZXBzLXBhcnNlci5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmUuanMiLCIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9odG1sLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvaWYuanMiLCIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9pbmRleC5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL21vZGVsLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy92dWUvc3JjL2RpcmVjdGl2ZXMvb24uanMiLCIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9yZXBlYXQuanMiLCIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZGlyZWN0aXZlcy9zdHlsZS5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy9kaXJlY3RpdmVzL3dpdGguanMiLCIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL3Z1ZS9zcmMvZW1pdHRlci5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy9leHAtcGFyc2VyLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy92dWUvc3JjL2ZpbHRlcnMuanMiLCIvVXNlcnMvY2hyaXMvc2l0ZXMvVnVlLVNob3BwaW5nLUNhcnQvbm9kZV9tb2R1bGVzL3Z1ZS9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy90ZXh0LXBhcnNlci5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9ub2RlX21vZHVsZXMvdnVlL3NyYy90cmFuc2l0aW9uLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy92dWUvc3JjL3V0aWxzLmpzIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L25vZGVfbW9kdWxlcy92dWUvc3JjL3ZpZXdtb2RlbC5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9zcmMvY29tcG9uZW50cy9wcm9kdWN0cy9pbmRleC5qcyIsIi9Vc2Vycy9jaHJpcy9zaXRlcy9WdWUtU2hvcHBpbmctQ2FydC9zcmMvY29tcG9uZW50cy9wcm9kdWN0cy90ZW1wbGF0ZS5odG1sIiwiL1VzZXJzL2NocmlzL3NpdGVzL1Z1ZS1TaG9wcGluZy1DYXJ0L3NyYy9mYWtlXzY0MWE0MTMzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2p2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpLFxuICAgIHF1ZXVlLCBoYXMsIHdhaXRpbmdcblxucmVzZXQoKVxuXG5leHBvcnRzLnF1ZXVlID0gZnVuY3Rpb24gKGJpbmRpbmcpIHtcbiAgICBpZiAoIWhhc1tiaW5kaW5nLmlkXSkge1xuICAgICAgICBxdWV1ZS5wdXNoKGJpbmRpbmcpXG4gICAgICAgIGhhc1tiaW5kaW5nLmlkXSA9IHRydWVcbiAgICAgICAgaWYgKCF3YWl0aW5nKSB7XG4gICAgICAgICAgICB3YWl0aW5nID0gdHJ1ZVxuICAgICAgICAgICAgdXRpbHMubmV4dFRpY2soZmx1c2gpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZsdXNoICgpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBiID0gcXVldWVbaV1cbiAgICAgICAgaWYgKGIudW5ib3VuZCkgY29udGludWVcbiAgICAgICAgYi5fdXBkYXRlKClcbiAgICAgICAgaGFzW2IuaWRdID0gZmFsc2VcbiAgICB9XG4gICAgcmVzZXQoKVxufVxuXG5mdW5jdGlvbiByZXNldCAoKSB7XG4gICAgcXVldWUgPSBbXVxuICAgIGhhcyA9IHV0aWxzLmhhc2goKVxuICAgIHdhaXRpbmcgPSBmYWxzZVxufSIsInZhciBiYXRjaGVyID0gcmVxdWlyZSgnLi9iYXRjaGVyJyksXG4gICAgaWQgPSAwXG5cbi8qKlxuICogIEJpbmRpbmcgY2xhc3MuXG4gKlxuICogIGVhY2ggcHJvcGVydHkgb24gdGhlIHZpZXdtb2RlbCBoYXMgb25lIGNvcnJlc3BvbmRpbmcgQmluZGluZyBvYmplY3RcbiAqICB3aGljaCBoYXMgbXVsdGlwbGUgZGlyZWN0aXZlIGluc3RhbmNlcyBvbiB0aGUgRE9NXG4gKiAgYW5kIG11bHRpcGxlIGNvbXB1dGVkIHByb3BlcnR5IGRlcGVuZGVudHNcbiAqL1xuZnVuY3Rpb24gQmluZGluZyAoY29tcGlsZXIsIGtleSwgaXNFeHAsIGlzRm4pIHtcbiAgICB0aGlzLmlkID0gaWQrK1xuICAgIHRoaXMudmFsdWUgPSB1bmRlZmluZWRcbiAgICB0aGlzLmlzRXhwID0gISFpc0V4cFxuICAgIHRoaXMuaXNGbiA9IGlzRm5cbiAgICB0aGlzLnJvb3QgPSAhdGhpcy5pc0V4cCAmJiBrZXkuaW5kZXhPZignLicpID09PSAtMVxuICAgIHRoaXMuY29tcGlsZXIgPSBjb21waWxlclxuICAgIHRoaXMua2V5ID0ga2V5XG4gICAgdGhpcy5kaXJzID0gW11cbiAgICB0aGlzLnN1YnMgPSBbXVxuICAgIHRoaXMuZGVwcyA9IFtdXG4gICAgdGhpcy51bmJvdW5kID0gZmFsc2Vcbn1cblxudmFyIEJpbmRpbmdQcm90byA9IEJpbmRpbmcucHJvdG90eXBlXG5cbi8qKlxuICogIFVwZGF0ZSB2YWx1ZSBhbmQgcXVldWUgaW5zdGFuY2UgdXBkYXRlcy5cbiAqL1xuQmluZGluZ1Byb3RvLnVwZGF0ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIGlmICghdGhpcy5pc0NvbXB1dGVkIHx8IHRoaXMuaXNGbikge1xuICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWVcbiAgICB9XG4gICAgaWYgKHRoaXMuZGlycy5sZW5ndGggfHwgdGhpcy5zdWJzLmxlbmd0aCkge1xuICAgICAgICBiYXRjaGVyLnF1ZXVlKHRoaXMpXG4gICAgfVxufVxuXG4vKipcbiAqICBBY3R1YWxseSB1cGRhdGUgdGhlIGRpcmVjdGl2ZXMuXG4gKi9cbkJpbmRpbmdQcm90by5fdXBkYXRlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpID0gdGhpcy5kaXJzLmxlbmd0aCxcbiAgICAgICAgdmFsdWUgPSB0aGlzLnZhbCgpXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLmRpcnNbaV0udXBkYXRlKHZhbHVlKVxuICAgIH1cbiAgICB0aGlzLnB1YigpXG59XG5cbi8qKlxuICogIFJldHVybiB0aGUgdmFsdWF0ZWQgdmFsdWUgcmVnYXJkbGVzc1xuICogIG9mIHdoZXRoZXIgaXQgaXMgY29tcHV0ZWQgb3Igbm90XG4gKi9cbkJpbmRpbmdQcm90by52YWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuaXNDb21wdXRlZCAmJiAhdGhpcy5pc0ZuXG4gICAgICAgID8gdGhpcy52YWx1ZS4kZ2V0KClcbiAgICAgICAgOiB0aGlzLnZhbHVlXG59XG5cbi8qKlxuICogIE5vdGlmeSBjb21wdXRlZCBwcm9wZXJ0aWVzIHRoYXQgZGVwZW5kIG9uIHRoaXMgYmluZGluZ1xuICogIHRvIHVwZGF0ZSB0aGVtc2VsdmVzXG4gKi9cbkJpbmRpbmdQcm90by5wdWIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGkgPSB0aGlzLnN1YnMubGVuZ3RoXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICB0aGlzLnN1YnNbaV0udXBkYXRlKClcbiAgICB9XG59XG5cbi8qKlxuICogIFVuYmluZCB0aGUgYmluZGluZywgcmVtb3ZlIGl0c2VsZiBmcm9tIGFsbCBvZiBpdHMgZGVwZW5kZW5jaWVzXG4gKi9cbkJpbmRpbmdQcm90by51bmJpbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gSW5kaWNhdGUgdGhpcyBoYXMgYmVlbiB1bmJvdW5kLlxuICAgIC8vIEl0J3MgcG9zc2libGUgdGhpcyBiaW5kaW5nIHdpbGwgYmUgaW5cbiAgICAvLyB0aGUgYmF0Y2hlcidzIGZsdXNoIHF1ZXVlIHdoZW4gaXRzIG93bmVyXG4gICAgLy8gY29tcGlsZXIgaGFzIGFscmVhZHkgYmVlbiBkZXN0cm95ZWQuXG4gICAgdGhpcy51bmJvdW5kID0gdHJ1ZVxuICAgIHZhciBpID0gdGhpcy5kaXJzLmxlbmd0aFxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdGhpcy5kaXJzW2ldLnVuYmluZCgpXG4gICAgfVxuICAgIGkgPSB0aGlzLmRlcHMubGVuZ3RoXG4gICAgdmFyIHN1YnNcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIHN1YnMgPSB0aGlzLmRlcHNbaV0uc3Vic1xuICAgICAgICBzdWJzLnNwbGljZShzdWJzLmluZGV4T2YodGhpcyksIDEpXG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEJpbmRpbmciLCJ2YXIgRW1pdHRlciAgICAgPSByZXF1aXJlKCcuL2VtaXR0ZXInKSxcbiAgICBPYnNlcnZlciAgICA9IHJlcXVpcmUoJy4vb2JzZXJ2ZXInKSxcbiAgICBjb25maWcgICAgICA9IHJlcXVpcmUoJy4vY29uZmlnJyksXG4gICAgdXRpbHMgICAgICAgPSByZXF1aXJlKCcuL3V0aWxzJyksXG4gICAgQmluZGluZyAgICAgPSByZXF1aXJlKCcuL2JpbmRpbmcnKSxcbiAgICBEaXJlY3RpdmUgICA9IHJlcXVpcmUoJy4vZGlyZWN0aXZlJyksXG4gICAgVGV4dFBhcnNlciAgPSByZXF1aXJlKCcuL3RleHQtcGFyc2VyJyksXG4gICAgRGVwc1BhcnNlciAgPSByZXF1aXJlKCcuL2RlcHMtcGFyc2VyJyksXG4gICAgRXhwUGFyc2VyICAgPSByZXF1aXJlKCcuL2V4cC1wYXJzZXInKSxcbiAgICBcbiAgICAvLyBjYWNoZSBtZXRob2RzXG4gICAgc2xpY2UgICAgICAgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UsXG4gICAgbG9nICAgICAgICAgPSB1dGlscy5sb2csXG4gICAgbWFrZUhhc2ggICAgPSB1dGlscy5oYXNoLFxuICAgIGV4dGVuZCAgICAgID0gdXRpbHMuZXh0ZW5kLFxuICAgIGRlZiAgICAgICAgID0gdXRpbHMuZGVmUHJvdGVjdGVkLFxuICAgIGhhc093biAgICAgID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSxcblxuICAgIC8vIGhvb2tzIHRvIHJlZ2lzdGVyXG4gICAgaG9va3MgPSBbXG4gICAgICAgICdjcmVhdGVkJywgJ3JlYWR5JyxcbiAgICAgICAgJ2JlZm9yZURlc3Ryb3knLCAnYWZ0ZXJEZXN0cm95JyxcbiAgICAgICAgJ2F0dGFjaGVkJywgJ2RldGFjaGVkJ1xuICAgIF1cblxuLyoqXG4gKiAgVGhlIERPTSBjb21waWxlclxuICogIHNjYW5zIGEgRE9NIG5vZGUgYW5kIGNvbXBpbGUgYmluZGluZ3MgZm9yIGEgVmlld01vZGVsXG4gKi9cbmZ1bmN0aW9uIENvbXBpbGVyICh2bSwgb3B0aW9ucykge1xuXG4gICAgdmFyIGNvbXBpbGVyID0gdGhpc1xuICAgIC8vIGluZGljYXRlIHRoYXQgd2UgYXJlIGludGlhdGluZyB0aGlzIGluc3RhbmNlXG4gICAgLy8gc28gd2Ugc2hvdWxkIG5vdCBydW4gYW55IHRyYW5zaXRpb25zXG4gICAgY29tcGlsZXIuaW5pdCA9IHRydWVcblxuICAgIC8vIHByb2Nlc3MgYW5kIGV4dGVuZCBvcHRpb25zXG4gICAgb3B0aW9ucyA9IGNvbXBpbGVyLm9wdGlvbnMgPSBvcHRpb25zIHx8IG1ha2VIYXNoKClcbiAgICB1dGlscy5wcm9jZXNzT3B0aW9ucyhvcHRpb25zKVxuXG4gICAgLy8gY29weSBkYXRhLCBtZXRob2RzICYgY29tcGlsZXIgb3B0aW9uc1xuICAgIHZhciBkYXRhID0gY29tcGlsZXIuZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fVxuICAgIGV4dGVuZCh2bSwgZGF0YSwgdHJ1ZSlcbiAgICBleHRlbmQodm0sIG9wdGlvbnMubWV0aG9kcywgdHJ1ZSlcbiAgICBleHRlbmQoY29tcGlsZXIsIG9wdGlvbnMuY29tcGlsZXJPcHRpb25zKVxuXG4gICAgLy8gaW5pdGlhbGl6ZSBlbGVtZW50XG4gICAgdmFyIGVsID0gY29tcGlsZXIuc2V0dXBFbGVtZW50KG9wdGlvbnMpXG4gICAgbG9nKCdcXG5uZXcgVk0gaW5zdGFuY2U6JywgZWwudGFnTmFtZSwgJ1xcbicpXG5cbiAgICAvLyBzZXQgY29tcGlsZXIgcHJvcGVydGllc1xuICAgIGNvbXBpbGVyLnZtICA9IHZtXG4gICAgY29tcGlsZXIuYmluZGluZ3MgPSBtYWtlSGFzaCgpXG4gICAgY29tcGlsZXIuZGlycyA9IFtdXG4gICAgY29tcGlsZXIuZGVmZXJyZWQgPSBbXVxuICAgIGNvbXBpbGVyLmV4cHMgPSBbXVxuICAgIGNvbXBpbGVyLmNvbXB1dGVkID0gW11cbiAgICBjb21waWxlci5jaGlsZENvbXBpbGVycyA9IFtdXG4gICAgY29tcGlsZXIuZW1pdHRlciA9IG5ldyBFbWl0dGVyKClcblxuICAgIC8vIHNldCBpbmVudW1lcmFibGUgVk0gcHJvcGVydGllc1xuICAgIGRlZih2bSwgJyQnLCBtYWtlSGFzaCgpKVxuICAgIGRlZih2bSwgJyRlbCcsIGVsKVxuICAgIGRlZih2bSwgJyRjb21waWxlcicsIGNvbXBpbGVyKVxuICAgIGRlZih2bSwgJyRyb290JywgZ2V0Um9vdChjb21waWxlcikudm0pXG5cbiAgICAvLyBzZXQgcGFyZW50IFZNXG4gICAgLy8gYW5kIHJlZ2lzdGVyIGNoaWxkIGlkIG9uIHBhcmVudFxuICAgIHZhciBwYXJlbnQgPSBjb21waWxlci5wYXJlbnRDb21waWxlcixcbiAgICAgICAgY2hpbGRJZCA9IHV0aWxzLmF0dHIoZWwsICdyZWYnKVxuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgcGFyZW50LmNoaWxkQ29tcGlsZXJzLnB1c2goY29tcGlsZXIpXG4gICAgICAgIGRlZih2bSwgJyRwYXJlbnQnLCBwYXJlbnQudm0pXG4gICAgICAgIGlmIChjaGlsZElkKSB7XG4gICAgICAgICAgICBjb21waWxlci5jaGlsZElkID0gY2hpbGRJZFxuICAgICAgICAgICAgcGFyZW50LnZtLiRbY2hpbGRJZF0gPSB2bVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0dXAgb2JzZXJ2ZXJcbiAgICBjb21waWxlci5zZXR1cE9ic2VydmVyKClcblxuICAgIC8vIGNyZWF0ZSBiaW5kaW5ncyBmb3IgY29tcHV0ZWQgcHJvcGVydGllc1xuICAgIHZhciBjb21wdXRlZCA9IG9wdGlvbnMuY29tcHV0ZWRcbiAgICBpZiAoY29tcHV0ZWQpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIGNvbXB1dGVkKSB7XG4gICAgICAgICAgICBjb21waWxlci5jcmVhdGVCaW5kaW5nKGtleSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGJlZm9yZUNvbXBpbGUgaG9va1xuICAgIGNvbXBpbGVyLmV4ZWNIb29rKCdjcmVhdGVkJylcblxuICAgIC8vIHRoZSB1c2VyIG1pZ2h0IGhhdmUgc2V0IHNvbWUgcHJvcHMgb24gdGhlIHZtIFxuICAgIC8vIHNvIGNvcHkgaXQgYmFjayB0byB0aGUgZGF0YS4uLlxuICAgIGV4dGVuZChkYXRhLCB2bSlcblxuICAgIC8vIG9ic2VydmUgdGhlIGRhdGFcbiAgICBjb21waWxlci5vYnNlcnZlRGF0YShkYXRhKVxuICAgIFxuICAgIC8vIGZvciByZXBlYXRlZCBpdGVtcywgY3JlYXRlIGFuIGluZGV4IGJpbmRpbmdcbiAgICAvLyB3aGljaCBzaG91bGQgYmUgaW5lbnVtZXJhYmxlIGJ1dCBjb25maWd1cmFibGVcbiAgICBpZiAoY29tcGlsZXIucmVwZWF0KSB7XG4gICAgICAgIC8vZGF0YS4kaW5kZXggPSBjb21waWxlci5yZXBlYXRJbmRleFxuICAgICAgICBkZWYoZGF0YSwgJyRpbmRleCcsIGNvbXBpbGVyLnJlcGVhdEluZGV4LCBmYWxzZSwgdHJ1ZSlcbiAgICAgICAgY29tcGlsZXIuY3JlYXRlQmluZGluZygnJGluZGV4JylcbiAgICB9XG5cbiAgICAvLyBub3cgcGFyc2UgdGhlIERPTSwgZHVyaW5nIHdoaWNoIHdlIHdpbGwgY3JlYXRlIG5lY2Vzc2FyeSBiaW5kaW5nc1xuICAgIC8vIGFuZCBiaW5kIHRoZSBwYXJzZWQgZGlyZWN0aXZlc1xuICAgIGNvbXBpbGVyLmNvbXBpbGUoZWwsIHRydWUpXG5cbiAgICAvLyBiaW5kIGRlZmVycmVkIGRpcmVjdGl2ZXMgKGNoaWxkIGNvbXBvbmVudHMpXG4gICAgY29tcGlsZXIuZGVmZXJyZWQuZm9yRWFjaChjb21waWxlci5iaW5kRGlyZWN0aXZlLCBjb21waWxlcilcblxuICAgIC8vIGV4dHJhY3QgZGVwZW5kZW5jaWVzIGZvciBjb21wdXRlZCBwcm9wZXJ0aWVzXG4gICAgY29tcGlsZXIucGFyc2VEZXBzKClcblxuICAgIC8vIGRvbmUhXG4gICAgY29tcGlsZXIuaW5pdCA9IGZhbHNlXG5cbiAgICAvLyBwb3N0IGNvbXBpbGUgLyByZWFkeSBob29rXG4gICAgY29tcGlsZXIuZXhlY0hvb2soJ3JlYWR5Jylcbn1cblxudmFyIENvbXBpbGVyUHJvdG8gPSBDb21waWxlci5wcm90b3R5cGVcblxuLyoqXG4gKiAgSW5pdGlhbGl6ZSB0aGUgVk0vQ29tcGlsZXIncyBlbGVtZW50LlxuICogIEZpbGwgaXQgaW4gd2l0aCB0aGUgdGVtcGxhdGUgaWYgbmVjZXNzYXJ5LlxuICovXG5Db21waWxlclByb3RvLnNldHVwRWxlbWVudCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgLy8gY3JlYXRlIHRoZSBub2RlIGZpcnN0XG4gICAgdmFyIGVsID0gdGhpcy5lbCA9IHR5cGVvZiBvcHRpb25zLmVsID09PSAnc3RyaW5nJ1xuICAgICAgICA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Iob3B0aW9ucy5lbClcbiAgICAgICAgOiBvcHRpb25zLmVsIHx8IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQob3B0aW9ucy50YWdOYW1lIHx8ICdkaXYnKVxuXG4gICAgdmFyIHRlbXBsYXRlID0gb3B0aW9ucy50ZW1wbGF0ZVxuICAgIGlmICh0ZW1wbGF0ZSkge1xuICAgICAgICAvLyByZXBsYWNlIG9wdGlvbjogdXNlIHRoZSBmaXJzdCBub2RlIGluXG4gICAgICAgIC8vIHRoZSB0ZW1wbGF0ZSBkaXJlY3RseVxuICAgICAgICBpZiAob3B0aW9ucy5yZXBsYWNlICYmIHRlbXBsYXRlLmNoaWxkTm9kZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICB2YXIgcmVwbGFjZXIgPSB0ZW1wbGF0ZS5jaGlsZE5vZGVzWzBdLmNsb25lTm9kZSh0cnVlKVxuICAgICAgICAgICAgaWYgKGVsLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgICAgICBlbC5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyZXBsYWNlciwgZWwpXG4gICAgICAgICAgICAgICAgZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsID0gcmVwbGFjZXJcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVsLmlubmVySFRNTCA9ICcnXG4gICAgICAgICAgICBlbC5hcHBlbmRDaGlsZCh0ZW1wbGF0ZS5jbG9uZU5vZGUodHJ1ZSkpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhcHBseSBlbGVtZW50IG9wdGlvbnNcbiAgICBpZiAob3B0aW9ucy5pZCkgZWwuaWQgPSBvcHRpb25zLmlkXG4gICAgaWYgKG9wdGlvbnMuY2xhc3NOYW1lKSBlbC5jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZVxuICAgIHZhciBhdHRycyA9IG9wdGlvbnMuYXR0cmlidXRlc1xuICAgIGlmIChhdHRycykge1xuICAgICAgICBmb3IgKHZhciBhdHRyIGluIGF0dHJzKSB7XG4gICAgICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ciwgYXR0cnNbYXR0cl0pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZWxcbn1cblxuLyoqXG4gKiAgU2V0dXAgb2JzZXJ2ZXIuXG4gKiAgVGhlIG9ic2VydmVyIGxpc3RlbnMgZm9yIGdldC9zZXQvbXV0YXRlIGV2ZW50cyBvbiBhbGwgVk1cbiAqICB2YWx1ZXMvb2JqZWN0cyBhbmQgdHJpZ2dlciBjb3JyZXNwb25kaW5nIGJpbmRpbmcgdXBkYXRlcy5cbiAqICBJdCBhbHNvIGxpc3RlbnMgZm9yIGxpZmVjeWNsZSBob29rcy5cbiAqL1xuQ29tcGlsZXJQcm90by5zZXR1cE9ic2VydmVyID0gZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGNvbXBpbGVyID0gdGhpcyxcbiAgICAgICAgYmluZGluZ3MgPSBjb21waWxlci5iaW5kaW5ncyxcbiAgICAgICAgb3B0aW9ucyAgPSBjb21waWxlci5vcHRpb25zLFxuICAgICAgICBvYnNlcnZlciA9IGNvbXBpbGVyLm9ic2VydmVyID0gbmV3IEVtaXR0ZXIoKVxuXG4gICAgLy8gYSBoYXNoIHRvIGhvbGQgZXZlbnQgcHJveGllcyBmb3IgZWFjaCByb290IGxldmVsIGtleVxuICAgIC8vIHNvIHRoZXkgY2FuIGJlIHJlZmVyZW5jZWQgYW5kIHJlbW92ZWQgbGF0ZXJcbiAgICBvYnNlcnZlci5wcm94aWVzID0gbWFrZUhhc2goKVxuXG4gICAgLy8gYWRkIG93biBsaXN0ZW5lcnMgd2hpY2ggdHJpZ2dlciBiaW5kaW5nIHVwZGF0ZXNcbiAgICBvYnNlcnZlclxuICAgICAgICAub24oJ2dldCcsIG9uR2V0KVxuICAgICAgICAub24oJ3NldCcsIG9uU2V0KVxuICAgICAgICAub24oJ211dGF0ZScsIG9uU2V0KVxuXG4gICAgLy8gcmVnaXN0ZXIgaG9va3NcbiAgICBob29rcy5mb3JFYWNoKGZ1bmN0aW9uIChob29rKSB7XG4gICAgICAgIHZhciBmbnMgPSBvcHRpb25zW2hvb2tdXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGZucykpIHtcbiAgICAgICAgICAgIHZhciBpID0gZm5zLmxlbmd0aFxuICAgICAgICAgICAgLy8gc2luY2UgaG9va3Mgd2VyZSBtZXJnZWQgd2l0aCBjaGlsZCBhdCBoZWFkLFxuICAgICAgICAgICAgLy8gd2UgbG9vcCByZXZlcnNlbHkuXG4gICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgcmVnaXN0ZXIoaG9vaywgZm5zW2ldKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGZucykge1xuICAgICAgICAgICAgcmVnaXN0ZXIoaG9vaywgZm5zKVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIGZ1bmN0aW9uIG9uR2V0IChrZXkpIHtcbiAgICAgICAgY2hlY2soa2V5KVxuICAgICAgICBEZXBzUGFyc2VyLmNhdGNoZXIuZW1pdCgnZ2V0JywgYmluZGluZ3Nba2V5XSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvblNldCAoa2V5LCB2YWwsIG11dGF0aW9uKSB7XG4gICAgICAgIG9ic2VydmVyLmVtaXQoJ2NoYW5nZTonICsga2V5LCB2YWwsIG11dGF0aW9uKVxuICAgICAgICBjaGVjayhrZXkpXG4gICAgICAgIGJpbmRpbmdzW2tleV0udXBkYXRlKHZhbClcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZWdpc3RlciAoaG9vaywgZm4pIHtcbiAgICAgICAgb2JzZXJ2ZXIub24oJ2hvb2s6JyArIGhvb2ssIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZuLmNhbGwoY29tcGlsZXIudm0sIG9wdGlvbnMpXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2hlY2sgKGtleSkge1xuICAgICAgICBpZiAoIWJpbmRpbmdzW2tleV0pIHtcbiAgICAgICAgICAgIGNvbXBpbGVyLmNyZWF0ZUJpbmRpbmcoa2V5KVxuICAgICAgICB9XG4gICAgfVxufVxuXG5Db21waWxlclByb3RvLm9ic2VydmVEYXRhID0gZnVuY3Rpb24gKGRhdGEpIHtcblxuICAgIHZhciBjb21waWxlciA9IHRoaXMsXG4gICAgICAgIG9ic2VydmVyID0gY29tcGlsZXIub2JzZXJ2ZXJcblxuICAgIC8vIHJlY3Vyc2l2ZWx5IG9ic2VydmUgbmVzdGVkIHByb3BlcnRpZXNcbiAgICBPYnNlcnZlci5vYnNlcnZlKGRhdGEsICcnLCBvYnNlcnZlcilcblxuICAgIC8vIGFsc28gY3JlYXRlIGJpbmRpbmcgZm9yIHRvcCBsZXZlbCAkZGF0YVxuICAgIC8vIHNvIGl0IGNhbiBiZSB1c2VkIGluIHRlbXBsYXRlcyB0b29cbiAgICB2YXIgJGRhdGFCaW5kaW5nID0gY29tcGlsZXIuYmluZGluZ3NbJyRkYXRhJ10gPSBuZXcgQmluZGluZyhjb21waWxlciwgJyRkYXRhJylcbiAgICAkZGF0YUJpbmRpbmcudXBkYXRlKGRhdGEpXG5cbiAgICAvLyBhbGxvdyAkZGF0YSB0byBiZSBzd2FwcGVkXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvbXBpbGVyLnZtLCAnJGRhdGEnLCB7XG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbXBpbGVyLm9ic2VydmVyLmVtaXQoJ2dldCcsICckZGF0YScpXG4gICAgICAgICAgICByZXR1cm4gY29tcGlsZXIuZGF0YVxuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChuZXdEYXRhKSB7XG4gICAgICAgICAgICB2YXIgb2xkRGF0YSA9IGNvbXBpbGVyLmRhdGFcbiAgICAgICAgICAgIE9ic2VydmVyLnVub2JzZXJ2ZShvbGREYXRhLCAnJywgb2JzZXJ2ZXIpXG4gICAgICAgICAgICBjb21waWxlci5kYXRhID0gbmV3RGF0YVxuICAgICAgICAgICAgT2JzZXJ2ZXIuY29weVBhdGhzKG5ld0RhdGEsIG9sZERhdGEpXG4gICAgICAgICAgICBPYnNlcnZlci5vYnNlcnZlKG5ld0RhdGEsICcnLCBvYnNlcnZlcilcbiAgICAgICAgICAgIGNvbXBpbGVyLm9ic2VydmVyLmVtaXQoJ3NldCcsICckZGF0YScsIG5ld0RhdGEpXG4gICAgICAgIH1cbiAgICB9KVxuXG4gICAgLy8gZW1pdCAkZGF0YSBjaGFuZ2Ugb24gYWxsIGNoYW5nZXNcbiAgICBvYnNlcnZlclxuICAgICAgICAub24oJ3NldCcsIG9uU2V0KVxuICAgICAgICAub24oJ211dGF0ZScsIG9uU2V0KVxuXG4gICAgZnVuY3Rpb24gb25TZXQgKGtleSkge1xuICAgICAgICBpZiAoa2V5ICE9PSAnJGRhdGEnKSB7XG4gICAgICAgICAgICAkZGF0YUJpbmRpbmcudXBkYXRlKGNvbXBpbGVyLmRhdGEpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogIENvbXBpbGUgYSBET00gbm9kZSAocmVjdXJzaXZlKVxuICovXG5Db21waWxlclByb3RvLmNvbXBpbGUgPSBmdW5jdGlvbiAobm9kZSwgcm9vdCkge1xuXG4gICAgdmFyIGNvbXBpbGVyID0gdGhpcyxcbiAgICAgICAgbm9kZVR5cGUgPSBub2RlLm5vZGVUeXBlLFxuICAgICAgICB0YWdOYW1lICA9IG5vZGUudGFnTmFtZVxuXG4gICAgaWYgKG5vZGVUeXBlID09PSAxICYmIHRhZ05hbWUgIT09ICdTQ1JJUFQnKSB7IC8vIGEgbm9ybWFsIG5vZGVcblxuICAgICAgICAvLyBza2lwIGFueXRoaW5nIHdpdGggdi1wcmVcbiAgICAgICAgaWYgKHV0aWxzLmF0dHIobm9kZSwgJ3ByZScpICE9PSBudWxsKSByZXR1cm5cblxuICAgICAgICAvLyBzcGVjaWFsIGF0dHJpYnV0ZXMgdG8gY2hlY2tcbiAgICAgICAgdmFyIHJlcGVhdEV4cCxcbiAgICAgICAgICAgIHdpdGhLZXksXG4gICAgICAgICAgICBwYXJ0aWFsSWQsXG4gICAgICAgICAgICBkaXJlY3RpdmUsXG4gICAgICAgICAgICBjb21wb25lbnRJZCA9IHV0aWxzLmF0dHIobm9kZSwgJ2NvbXBvbmVudCcpIHx8IHRhZ05hbWUudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgICAgIGNvbXBvbmVudEN0b3IgPSBjb21waWxlci5nZXRPcHRpb24oJ2NvbXBvbmVudHMnLCBjb21wb25lbnRJZClcblxuICAgICAgICAvLyBJdCBpcyBpbXBvcnRhbnQgdGhhdCB3ZSBhY2Nlc3MgdGhlc2UgYXR0cmlidXRlc1xuICAgICAgICAvLyBwcm9jZWR1cmFsbHkgYmVjYXVzZSB0aGUgb3JkZXIgbWF0dGVycy5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gYHV0aWxzLmF0dHJgIHJlbW92ZXMgdGhlIGF0dHJpYnV0ZSBvbmNlIGl0IGdldHMgdGhlXG4gICAgICAgIC8vIHZhbHVlLCBzbyB3ZSBzaG91bGQgbm90IGFjY2VzcyB0aGVtIGFsbCBhdCBvbmNlLlxuXG4gICAgICAgIC8vIHYtcmVwZWF0IGhhcyB0aGUgaGlnaGVzdCBwcmlvcml0eVxuICAgICAgICAvLyBhbmQgd2UgbmVlZCB0byBwcmVzZXJ2ZSBhbGwgb3RoZXIgYXR0cmlidXRlcyBmb3IgaXQuXG4gICAgICAgIC8qIGpzaGludCBib3NzOiB0cnVlICovXG4gICAgICAgIGlmIChyZXBlYXRFeHAgPSB1dGlscy5hdHRyKG5vZGUsICdyZXBlYXQnKSkge1xuXG4gICAgICAgICAgICAvLyByZXBlYXQgYmxvY2sgY2Fubm90IGhhdmUgdi1pZCBhdCB0aGUgc2FtZSB0aW1lLlxuICAgICAgICAgICAgZGlyZWN0aXZlID0gRGlyZWN0aXZlLnBhcnNlKCdyZXBlYXQnLCByZXBlYXRFeHAsIGNvbXBpbGVyLCBub2RlKVxuICAgICAgICAgICAgaWYgKGRpcmVjdGl2ZSkge1xuICAgICAgICAgICAgICAgIGRpcmVjdGl2ZS5DdG9yID0gY29tcG9uZW50Q3RvclxuICAgICAgICAgICAgICAgIC8vIGRlZmVyIGNoaWxkIGNvbXBvbmVudCBjb21waWxhdGlvblxuICAgICAgICAgICAgICAgIC8vIHNvIGJ5IHRoZSB0aW1lIHRoZXkgYXJlIGNvbXBpbGVkLCB0aGUgcGFyZW50XG4gICAgICAgICAgICAgICAgLy8gd291bGQgaGF2ZSBjb2xsZWN0ZWQgYWxsIGJpbmRpbmdzXG4gICAgICAgICAgICAgICAgY29tcGlsZXIuZGVmZXJyZWQucHVzaChkaXJlY3RpdmUpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgLy8gdi13aXRoIGhhcyAybmQgaGlnaGVzdCBwcmlvcml0eVxuICAgICAgICB9IGVsc2UgaWYgKHJvb3QgIT09IHRydWUgJiYgKCh3aXRoS2V5ID0gdXRpbHMuYXR0cihub2RlLCAnd2l0aCcpKSB8fCBjb21wb25lbnRDdG9yKSkge1xuXG4gICAgICAgICAgICBkaXJlY3RpdmUgPSBEaXJlY3RpdmUucGFyc2UoJ3dpdGgnLCB3aXRoS2V5IHx8ICcnLCBjb21waWxlciwgbm9kZSlcbiAgICAgICAgICAgIGlmIChkaXJlY3RpdmUpIHtcbiAgICAgICAgICAgICAgICBkaXJlY3RpdmUuQ3RvciA9IGNvbXBvbmVudEN0b3JcbiAgICAgICAgICAgICAgICBjb21waWxlci5kZWZlcnJlZC5wdXNoKGRpcmVjdGl2ZSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBjaGVjayB0cmFuc2l0aW9uIHByb3BlcnR5XG4gICAgICAgICAgICBub2RlLnZ1ZV90cmFucyA9IHV0aWxzLmF0dHIobm9kZSwgJ3RyYW5zaXRpb24nKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyByZXBsYWNlIGlubmVySFRNTCB3aXRoIHBhcnRpYWxcbiAgICAgICAgICAgIHBhcnRpYWxJZCA9IHV0aWxzLmF0dHIobm9kZSwgJ3BhcnRpYWwnKVxuICAgICAgICAgICAgaWYgKHBhcnRpYWxJZCkge1xuICAgICAgICAgICAgICAgIHZhciBwYXJ0aWFsID0gY29tcGlsZXIuZ2V0T3B0aW9uKCdwYXJ0aWFscycsIHBhcnRpYWxJZClcbiAgICAgICAgICAgICAgICBpZiAocGFydGlhbCkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLmlubmVySFRNTCA9ICcnXG4gICAgICAgICAgICAgICAgICAgIG5vZGUuYXBwZW5kQ2hpbGQocGFydGlhbC5jbG9uZU5vZGUodHJ1ZSkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBmaW5hbGx5LCBvbmx5IG5vcm1hbCBkaXJlY3RpdmVzIGxlZnQhXG4gICAgICAgICAgICBjb21waWxlci5jb21waWxlTm9kZShub2RlKVxuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKG5vZGVUeXBlID09PSAzKSB7IC8vIHRleHQgbm9kZVxuXG4gICAgICAgIGNvbXBpbGVyLmNvbXBpbGVUZXh0Tm9kZShub2RlKVxuXG4gICAgfVxuXG59XG5cbi8qKlxuICogIENvbXBpbGUgYSBub3JtYWwgbm9kZVxuICovXG5Db21waWxlclByb3RvLmNvbXBpbGVOb2RlID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgICB2YXIgaSwgaixcbiAgICAgICAgYXR0cnMgPSBzbGljZS5jYWxsKG5vZGUuYXR0cmlidXRlcyksXG4gICAgICAgIHByZWZpeCA9IGNvbmZpZy5wcmVmaXggKyAnLSdcbiAgICAvLyBwYXJzZSBpZiBoYXMgYXR0cmlidXRlc1xuICAgIGlmIChhdHRycyAmJiBhdHRycy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGF0dHIsIGlzRGlyZWN0aXZlLCBleHBzLCBleHAsIGRpcmVjdGl2ZSwgZGlybmFtZVxuICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGF0dHJpYnV0ZXNcbiAgICAgICAgaSA9IGF0dHJzLmxlbmd0aFxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBhdHRyID0gYXR0cnNbaV1cbiAgICAgICAgICAgIGlzRGlyZWN0aXZlID0gZmFsc2VcblxuICAgICAgICAgICAgaWYgKGF0dHIubmFtZS5pbmRleE9mKHByZWZpeCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBhIGRpcmVjdGl2ZSAtIHNwbGl0LCBwYXJzZSBhbmQgYmluZCBpdC5cbiAgICAgICAgICAgICAgICBpc0RpcmVjdGl2ZSA9IHRydWVcbiAgICAgICAgICAgICAgICBleHBzID0gRGlyZWN0aXZlLnNwbGl0KGF0dHIudmFsdWUpXG4gICAgICAgICAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGNsYXVzZXMgKHNlcGFyYXRlZCBieSBcIixcIilcbiAgICAgICAgICAgICAgICAvLyBpbnNpZGUgZWFjaCBhdHRyaWJ1dGVcbiAgICAgICAgICAgICAgICBqID0gZXhwcy5sZW5ndGhcbiAgICAgICAgICAgICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cCA9IGV4cHNbal1cbiAgICAgICAgICAgICAgICAgICAgZGlybmFtZSA9IGF0dHIubmFtZS5zbGljZShwcmVmaXgubGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgICBkaXJlY3RpdmUgPSBEaXJlY3RpdmUucGFyc2UoZGlybmFtZSwgZXhwLCB0aGlzLCBub2RlKVxuICAgICAgICAgICAgICAgICAgICBpZiAoZGlyZWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJpbmREaXJlY3RpdmUoZGlyZWN0aXZlKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBub24gZGlyZWN0aXZlIGF0dHJpYnV0ZSwgY2hlY2sgaW50ZXJwb2xhdGlvbiB0YWdzXG4gICAgICAgICAgICAgICAgZXhwID0gVGV4dFBhcnNlci5wYXJzZUF0dHIoYXR0ci52YWx1ZSlcbiAgICAgICAgICAgICAgICBpZiAoZXhwKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdGl2ZSA9IERpcmVjdGl2ZS5wYXJzZSgnYXR0cicsIGF0dHIubmFtZSArICc6JyArIGV4cCwgdGhpcywgbm9kZSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRpcmVjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iaW5kRGlyZWN0aXZlKGRpcmVjdGl2ZSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzRGlyZWN0aXZlICYmIGRpcm5hbWUgIT09ICdjbG9haycpIHtcbiAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyLm5hbWUpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gcmVjdXJzaXZlbHkgY29tcGlsZSBjaGlsZE5vZGVzXG4gICAgaWYgKG5vZGUuY2hpbGROb2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgc2xpY2UuY2FsbChub2RlLmNoaWxkTm9kZXMpLmZvckVhY2godGhpcy5jb21waWxlLCB0aGlzKVxuICAgIH1cbn1cblxuLyoqXG4gKiAgQ29tcGlsZSBhIHRleHQgbm9kZVxuICovXG5Db21waWxlclByb3RvLmNvbXBpbGVUZXh0Tm9kZSA9IGZ1bmN0aW9uIChub2RlKSB7XG5cbiAgICB2YXIgdG9rZW5zID0gVGV4dFBhcnNlci5wYXJzZShub2RlLm5vZGVWYWx1ZSlcbiAgICBpZiAoIXRva2VucykgcmV0dXJuXG4gICAgdmFyIGVsLCB0b2tlbiwgZGlyZWN0aXZlLCBwYXJ0aWFsLCBwYXJ0aWFsSWQsIHBhcnRpYWxOb2Rlc1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHRva2VuID0gdG9rZW5zW2ldXG4gICAgICAgIGRpcmVjdGl2ZSA9IHBhcnRpYWxOb2RlcyA9IG51bGxcbiAgICAgICAgaWYgKHRva2VuLmtleSkgeyAvLyBhIGJpbmRpbmdcbiAgICAgICAgICAgIGlmICh0b2tlbi5rZXkuY2hhckF0KDApID09PSAnPicpIHsgLy8gYSBwYXJ0aWFsXG4gICAgICAgICAgICAgICAgcGFydGlhbElkID0gdG9rZW4ua2V5LnNsaWNlKDEpLnRyaW0oKVxuICAgICAgICAgICAgICAgIHBhcnRpYWwgPSB0aGlzLmdldE9wdGlvbigncGFydGlhbHMnLCBwYXJ0aWFsSWQpXG4gICAgICAgICAgICAgICAgaWYgKHBhcnRpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgZWwgPSBwYXJ0aWFsLmNsb25lTm9kZSh0cnVlKVxuICAgICAgICAgICAgICAgICAgICAvLyBzYXZlIGFuIEFycmF5IHJlZmVyZW5jZSBvZiB0aGUgcGFydGlhbCdzIG5vZGVzXG4gICAgICAgICAgICAgICAgICAgIC8vIHNvIHdlIGNhbiBjb21waWxlIHRoZW0gQUZURVIgYXBwZW5kaW5nIHRoZSBmcmFnbWVudFxuICAgICAgICAgICAgICAgICAgICBwYXJ0aWFsTm9kZXMgPSBzbGljZS5jYWxsKGVsLmNoaWxkTm9kZXMpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHsgLy8gYSByZWFsIGJpbmRpbmdcbiAgICAgICAgICAgICAgICBpZiAoIXRva2VuLmh0bWwpIHsgLy8gdGV4dCBiaW5kaW5nXG4gICAgICAgICAgICAgICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpXG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdGl2ZSA9IERpcmVjdGl2ZS5wYXJzZSgndGV4dCcsIHRva2VuLmtleSwgdGhpcywgZWwpXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gaHRtbCBiaW5kaW5nXG4gICAgICAgICAgICAgICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlQ29tbWVudChjb25maWcucHJlZml4ICsgJy1odG1sJylcbiAgICAgICAgICAgICAgICAgICAgZGlyZWN0aXZlID0gRGlyZWN0aXZlLnBhcnNlKCdodG1sJywgdG9rZW4ua2V5LCB0aGlzLCBlbClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7IC8vIGEgcGxhaW4gc3RyaW5nXG4gICAgICAgICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRva2VuKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5zZXJ0IG5vZGVcbiAgICAgICAgbm9kZS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlbCwgbm9kZSlcblxuICAgICAgICAvLyBiaW5kIGRpcmVjdGl2ZVxuICAgICAgICBpZiAoZGlyZWN0aXZlKSB7XG4gICAgICAgICAgICB0aGlzLmJpbmREaXJlY3RpdmUoZGlyZWN0aXZlKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29tcGlsZSBwYXJ0aWFsIGFmdGVyIGFwcGVuZGluZywgYmVjYXVzZSBpdHMgY2hpbGRyZW4ncyBwYXJlbnROb2RlXG4gICAgICAgIC8vIHdpbGwgY2hhbmdlIGZyb20gdGhlIGZyYWdtZW50IHRvIHRoZSBjb3JyZWN0IHBhcmVudE5vZGUuXG4gICAgICAgIC8vIFRoaXMgY291bGQgYWZmZWN0IGRpcmVjdGl2ZXMgdGhhdCBuZWVkIGFjY2VzcyB0byBpdHMgZWxlbWVudCdzIHBhcmVudE5vZGUuXG4gICAgICAgIGlmIChwYXJ0aWFsTm9kZXMpIHtcbiAgICAgICAgICAgIHBhcnRpYWxOb2Rlcy5mb3JFYWNoKHRoaXMuY29tcGlsZSwgdGhpcylcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIG5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChub2RlKVxufVxuXG4vKipcbiAqICBBZGQgYSBkaXJlY3RpdmUgaW5zdGFuY2UgdG8gdGhlIGNvcnJlY3QgYmluZGluZyAmIHZpZXdtb2RlbFxuICovXG5Db21waWxlclByb3RvLmJpbmREaXJlY3RpdmUgPSBmdW5jdGlvbiAoZGlyZWN0aXZlKSB7XG5cbiAgICAvLyBrZWVwIHRyYWNrIG9mIGl0IHNvIHdlIGNhbiB1bmJpbmQoKSBsYXRlclxuICAgIHRoaXMuZGlycy5wdXNoKGRpcmVjdGl2ZSlcblxuICAgIC8vIGZvciBlbXB0eSBvciBsaXRlcmFsIGRpcmVjdGl2ZXMsIHNpbXBseSBjYWxsIGl0cyBiaW5kKClcbiAgICAvLyBhbmQgd2UncmUgZG9uZS5cbiAgICBpZiAoZGlyZWN0aXZlLmlzRW1wdHkgfHwgIWRpcmVjdGl2ZS5fdXBkYXRlKSB7XG4gICAgICAgIGlmIChkaXJlY3RpdmUuYmluZCkgZGlyZWN0aXZlLmJpbmQoKVxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBvdGhlcndpc2UsIHdlIGdvdCBtb3JlIHdvcmsgdG8gZG8uLi5cbiAgICB2YXIgYmluZGluZyxcbiAgICAgICAgY29tcGlsZXIgPSB0aGlzLFxuICAgICAgICBrZXkgICAgICA9IGRpcmVjdGl2ZS5rZXlcblxuICAgIGlmIChkaXJlY3RpdmUuaXNFeHApIHtcbiAgICAgICAgLy8gZXhwcmVzc2lvbiBiaW5kaW5ncyBhcmUgYWx3YXlzIGNyZWF0ZWQgb24gY3VycmVudCBjb21waWxlclxuICAgICAgICBiaW5kaW5nID0gY29tcGlsZXIuY3JlYXRlQmluZGluZyhrZXksIHRydWUsIGRpcmVjdGl2ZS5pc0ZuKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHJlY3Vyc2l2ZWx5IGxvY2F0ZSB3aGljaCBjb21waWxlciBvd25zIHRoZSBiaW5kaW5nXG4gICAgICAgIHdoaWxlIChjb21waWxlcikge1xuICAgICAgICAgICAgaWYgKGNvbXBpbGVyLmhhc0tleShrZXkpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcGlsZXIgPSBjb21waWxlci5wYXJlbnRDb21waWxlclxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbXBpbGVyID0gY29tcGlsZXIgfHwgdGhpc1xuICAgICAgICBiaW5kaW5nID0gY29tcGlsZXIuYmluZGluZ3Nba2V5XSB8fCBjb21waWxlci5jcmVhdGVCaW5kaW5nKGtleSlcbiAgICB9XG4gICAgYmluZGluZy5kaXJzLnB1c2goZGlyZWN0aXZlKVxuICAgIGRpcmVjdGl2ZS5iaW5kaW5nID0gYmluZGluZ1xuXG4gICAgLy8gaW52b2tlIGJpbmQgaG9vayBpZiBleGlzdHNcbiAgICBpZiAoZGlyZWN0aXZlLmJpbmQpIHtcbiAgICAgICAgZGlyZWN0aXZlLmJpbmQoKVxuICAgIH1cblxuICAgIC8vIHNldCBpbml0aWFsIHZhbHVlXG4gICAgZGlyZWN0aXZlLnVwZGF0ZShiaW5kaW5nLnZhbCgpLCB0cnVlKVxufVxuXG4vKipcbiAqICBDcmVhdGUgYmluZGluZyBhbmQgYXR0YWNoIGdldHRlci9zZXR0ZXIgZm9yIGEga2V5IHRvIHRoZSB2aWV3bW9kZWwgb2JqZWN0XG4gKi9cbkNvbXBpbGVyUHJvdG8uY3JlYXRlQmluZGluZyA9IGZ1bmN0aW9uIChrZXksIGlzRXhwLCBpc0ZuKSB7XG5cbiAgICBsb2coJyAgY3JlYXRlZCBiaW5kaW5nOiAnICsga2V5KVxuXG4gICAgdmFyIGNvbXBpbGVyID0gdGhpcyxcbiAgICAgICAgYmluZGluZ3MgPSBjb21waWxlci5iaW5kaW5ncyxcbiAgICAgICAgY29tcHV0ZWQgPSBjb21waWxlci5vcHRpb25zLmNvbXB1dGVkLFxuICAgICAgICBiaW5kaW5nICA9IG5ldyBCaW5kaW5nKGNvbXBpbGVyLCBrZXksIGlzRXhwLCBpc0ZuKVxuXG4gICAgaWYgKGlzRXhwKSB7XG4gICAgICAgIC8vIGV4cHJlc3Npb24gYmluZGluZ3MgYXJlIGFub255bW91c1xuICAgICAgICBjb21waWxlci5kZWZpbmVFeHAoa2V5LCBiaW5kaW5nKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmRpbmdzW2tleV0gPSBiaW5kaW5nXG4gICAgICAgIGlmIChiaW5kaW5nLnJvb3QpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgYSByb290IGxldmVsIGJpbmRpbmcuIHdlIG5lZWQgdG8gZGVmaW5lIGdldHRlci9zZXR0ZXJzIGZvciBpdC5cbiAgICAgICAgICAgIGlmIChjb21wdXRlZCAmJiBjb21wdXRlZFtrZXldKSB7XG4gICAgICAgICAgICAgICAgLy8gY29tcHV0ZWQgcHJvcGVydHlcbiAgICAgICAgICAgICAgICBjb21waWxlci5kZWZpbmVDb21wdXRlZChrZXksIGJpbmRpbmcsIGNvbXB1dGVkW2tleV0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIG5vcm1hbCBwcm9wZXJ0eVxuICAgICAgICAgICAgICAgIGNvbXBpbGVyLmRlZmluZVByb3Aoa2V5LCBiaW5kaW5nKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZW5zdXJlIHBhdGggaW4gZGF0YSBzbyBpdCBjYW4gYmUgb2JzZXJ2ZWRcbiAgICAgICAgICAgIE9ic2VydmVyLmVuc3VyZVBhdGgoY29tcGlsZXIuZGF0YSwga2V5KVxuICAgICAgICAgICAgdmFyIHBhcmVudEtleSA9IGtleS5zbGljZSgwLCBrZXkubGFzdEluZGV4T2YoJy4nKSlcbiAgICAgICAgICAgIGlmICghYmluZGluZ3NbcGFyZW50S2V5XSkge1xuICAgICAgICAgICAgICAgIC8vIHRoaXMgaXMgYSBuZXN0ZWQgdmFsdWUgYmluZGluZywgYnV0IHRoZSBiaW5kaW5nIGZvciBpdHMgcGFyZW50XG4gICAgICAgICAgICAgICAgLy8gaGFzIG5vdCBiZWVuIGNyZWF0ZWQgeWV0LiBXZSBiZXR0ZXIgY3JlYXRlIHRoYXQgb25lIHRvby5cbiAgICAgICAgICAgICAgICBjb21waWxlci5jcmVhdGVCaW5kaW5nKHBhcmVudEtleSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmluZGluZ1xufVxuXG4vKipcbiAqICBEZWZpbmUgdGhlIGdldHRlci9zZXR0ZXIgZm9yIGEgcm9vdC1sZXZlbCBwcm9wZXJ0eSBvbiB0aGUgVk1cbiAqICBhbmQgb2JzZXJ2ZSB0aGUgaW5pdGlhbCB2YWx1ZVxuICovXG5Db21waWxlclByb3RvLmRlZmluZVByb3AgPSBmdW5jdGlvbiAoa2V5LCBiaW5kaW5nKSB7XG4gICAgXG4gICAgdmFyIGNvbXBpbGVyID0gdGhpcyxcbiAgICAgICAgZGF0YSAgICAgPSBjb21waWxlci5kYXRhLFxuICAgICAgICBvYiAgICAgICA9IGRhdGEuX19vYnNlcnZlcl9fXG5cbiAgICAvLyBtYWtlIHN1cmUgdGhlIGtleSBpcyBwcmVzZW50IGluIGRhdGFcbiAgICAvLyBzbyBpdCBjYW4gYmUgb2JzZXJ2ZWRcbiAgICBpZiAoIShrZXkgaW4gZGF0YSkpIHtcbiAgICAgICAgZGF0YVtrZXldID0gdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgLy8gaWYgdGhlIGRhdGEgb2JqZWN0IGlzIGFscmVhZHkgb2JzZXJ2ZWQsIGJ1dCB0aGUga2V5XG4gICAgLy8gaXMgbm90IG9ic2VydmVkLCB3ZSBuZWVkIHRvIGFkZCBpdCB0byB0aGUgb2JzZXJ2ZWQga2V5cy5cbiAgICBpZiAob2IgJiYgIShrZXkgaW4gb2IudmFsdWVzKSkge1xuICAgICAgICBPYnNlcnZlci5jb252ZXJ0KGRhdGEsIGtleSlcbiAgICB9XG5cbiAgICBiaW5kaW5nLnZhbHVlID0gZGF0YVtrZXldXG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29tcGlsZXIudm0sIGtleSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21waWxlci5kYXRhW2tleV1cbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgICAgICBjb21waWxlci5kYXRhW2tleV0gPSB2YWxcbiAgICAgICAgfVxuICAgIH0pXG59XG5cbi8qKlxuICogIERlZmluZSBhbiBleHByZXNzaW9uIGJpbmRpbmcsIHdoaWNoIGlzIGVzc2VudGlhbGx5XG4gKiAgYW4gYW5vbnltb3VzIGNvbXB1dGVkIHByb3BlcnR5XG4gKi9cbkNvbXBpbGVyUHJvdG8uZGVmaW5lRXhwID0gZnVuY3Rpb24gKGtleSwgYmluZGluZykge1xuICAgIHZhciBnZXR0ZXIgPSBFeHBQYXJzZXIucGFyc2Uoa2V5LCB0aGlzKVxuICAgIGlmIChnZXR0ZXIpIHtcbiAgICAgICAgdGhpcy5tYXJrQ29tcHV0ZWQoYmluZGluZywgZ2V0dGVyKVxuICAgICAgICB0aGlzLmV4cHMucHVzaChiaW5kaW5nKVxuICAgIH1cbn1cblxuLyoqXG4gKiAgRGVmaW5lIGEgY29tcHV0ZWQgcHJvcGVydHkgb24gdGhlIFZNXG4gKi9cbkNvbXBpbGVyUHJvdG8uZGVmaW5lQ29tcHV0ZWQgPSBmdW5jdGlvbiAoa2V5LCBiaW5kaW5nLCB2YWx1ZSkge1xuICAgIHRoaXMubWFya0NvbXB1dGVkKGJpbmRpbmcsIHZhbHVlKVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLnZtLCBrZXksIHtcbiAgICAgICAgZ2V0OiBiaW5kaW5nLnZhbHVlLiRnZXQsXG4gICAgICAgIHNldDogYmluZGluZy52YWx1ZS4kc2V0XG4gICAgfSlcbn1cblxuLyoqXG4gKiAgUHJvY2VzcyBhIGNvbXB1dGVkIHByb3BlcnR5IGJpbmRpbmdcbiAqICBzbyBpdHMgZ2V0dGVyL3NldHRlciBhcmUgYm91bmQgdG8gcHJvcGVyIGNvbnRleHRcbiAqL1xuQ29tcGlsZXJQcm90by5tYXJrQ29tcHV0ZWQgPSBmdW5jdGlvbiAoYmluZGluZywgdmFsdWUpIHtcbiAgICBiaW5kaW5nLmlzQ29tcHV0ZWQgPSB0cnVlXG4gICAgLy8gYmluZCB0aGUgYWNjZXNzb3JzIHRvIHRoZSB2bVxuICAgIGlmIChiaW5kaW5nLmlzRm4pIHtcbiAgICAgICAgYmluZGluZy52YWx1ZSA9IHZhbHVlXG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdmFsdWUgPSB7ICRnZXQ6IHZhbHVlIH1cbiAgICAgICAgfVxuICAgICAgICBiaW5kaW5nLnZhbHVlID0ge1xuICAgICAgICAgICAgJGdldDogdXRpbHMuYmluZCh2YWx1ZS4kZ2V0LCB0aGlzLnZtKSxcbiAgICAgICAgICAgICRzZXQ6IHZhbHVlLiRzZXRcbiAgICAgICAgICAgICAgICA/IHV0aWxzLmJpbmQodmFsdWUuJHNldCwgdGhpcy52bSlcbiAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGtlZXAgdHJhY2sgZm9yIGRlcCBwYXJzaW5nIGxhdGVyXG4gICAgdGhpcy5jb21wdXRlZC5wdXNoKGJpbmRpbmcpXG59XG5cbi8qKlxuICogIFJldHJpdmUgYW4gb3B0aW9uIGZyb20gdGhlIGNvbXBpbGVyXG4gKi9cbkNvbXBpbGVyUHJvdG8uZ2V0T3B0aW9uID0gZnVuY3Rpb24gKHR5cGUsIGlkKSB7XG4gICAgdmFyIG9wdHMgPSB0aGlzLm9wdGlvbnMsXG4gICAgICAgIHBhcmVudCA9IHRoaXMucGFyZW50Q29tcGlsZXJcbiAgICByZXR1cm4gKG9wdHNbdHlwZV0gJiYgb3B0c1t0eXBlXVtpZF0pIHx8IChcbiAgICAgICAgcGFyZW50XG4gICAgICAgICAgICA/IHBhcmVudC5nZXRPcHRpb24odHlwZSwgaWQpXG4gICAgICAgICAgICA6IHV0aWxzW3R5cGVdICYmIHV0aWxzW3R5cGVdW2lkXVxuICAgIClcbn1cblxuLyoqXG4gKiAgRW1pdCBsaWZlY3ljbGUgZXZlbnRzIHRvIHRyaWdnZXIgaG9va3NcbiAqL1xuQ29tcGlsZXJQcm90by5leGVjSG9vayA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIGV2ZW50ID0gJ2hvb2s6JyArIGV2ZW50XG4gICAgdGhpcy5vYnNlcnZlci5lbWl0KGV2ZW50KVxuICAgIHRoaXMuZW1pdHRlci5lbWl0KGV2ZW50KVxufVxuXG4vKipcbiAqICBDaGVjayBpZiBhIGNvbXBpbGVyJ3MgZGF0YSBjb250YWlucyBhIGtleXBhdGhcbiAqL1xuQ29tcGlsZXJQcm90by5oYXNLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgdmFyIGJhc2VLZXkgPSBrZXkuc3BsaXQoJy4nKVswXVxuICAgIHJldHVybiBoYXNPd24uY2FsbCh0aGlzLmRhdGEsIGJhc2VLZXkpIHx8XG4gICAgICAgIGhhc093bi5jYWxsKHRoaXMudm0sIGJhc2VLZXkpXG59XG5cbi8qKlxuICogIENvbGxlY3QgZGVwZW5kZW5jaWVzIGZvciBjb21wdXRlZCBwcm9wZXJ0aWVzXG4gKi9cbkNvbXBpbGVyUHJvdG8ucGFyc2VEZXBzID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5jb21wdXRlZC5sZW5ndGgpIHJldHVyblxuICAgIERlcHNQYXJzZXIucGFyc2UodGhpcy5jb21wdXRlZClcbn1cblxuLyoqXG4gKiAgVW5iaW5kIGFuZCByZW1vdmUgZWxlbWVudFxuICovXG5Db21waWxlclByb3RvLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyBhdm9pZCBiZWluZyBjYWxsZWQgbW9yZSB0aGFuIG9uY2VcbiAgICAvLyB0aGlzIGlzIGlycmV2ZXJzaWJsZSFcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVyblxuXG4gICAgdmFyIGNvbXBpbGVyID0gdGhpcyxcbiAgICAgICAgaSwga2V5LCBkaXIsIGRpcnMsIGJpbmRpbmcsXG4gICAgICAgIHZtICAgICAgICAgID0gY29tcGlsZXIudm0sXG4gICAgICAgIGVsICAgICAgICAgID0gY29tcGlsZXIuZWwsXG4gICAgICAgIGRpcmVjdGl2ZXMgID0gY29tcGlsZXIuZGlycyxcbiAgICAgICAgZXhwcyAgICAgICAgPSBjb21waWxlci5leHBzLFxuICAgICAgICBiaW5kaW5ncyAgICA9IGNvbXBpbGVyLmJpbmRpbmdzXG5cbiAgICBjb21waWxlci5leGVjSG9vaygnYmVmb3JlRGVzdHJveScpXG5cbiAgICAvLyB1bm9ic2VydmUgZGF0YVxuICAgIE9ic2VydmVyLnVub2JzZXJ2ZShjb21waWxlci5kYXRhLCAnJywgY29tcGlsZXIub2JzZXJ2ZXIpXG5cbiAgICAvLyB1bmJpbmQgYWxsIGRpcmVjaXR2ZXNcbiAgICBpID0gZGlyZWN0aXZlcy5sZW5ndGhcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGRpciA9IGRpcmVjdGl2ZXNbaV1cbiAgICAgICAgLy8gaWYgdGhpcyBkaXJlY3RpdmUgaXMgYW4gaW5zdGFuY2Ugb2YgYW4gZXh0ZXJuYWwgYmluZGluZ1xuICAgICAgICAvLyBlLmcuIGEgZGlyZWN0aXZlIHRoYXQgcmVmZXJzIHRvIGEgdmFyaWFibGUgb24gdGhlIHBhcmVudCBWTVxuICAgICAgICAvLyB3ZSBuZWVkIHRvIHJlbW92ZSBpdCBmcm9tIHRoYXQgYmluZGluZydzIGRpcmVjdGl2ZXNcbiAgICAgICAgLy8gKiBlbXB0eSBhbmQgbGl0ZXJhbCBiaW5kaW5ncyBkbyBub3QgaGF2ZSBiaW5kaW5nLlxuICAgICAgICBpZiAoZGlyLmJpbmRpbmcgJiYgZGlyLmJpbmRpbmcuY29tcGlsZXIgIT09IGNvbXBpbGVyKSB7XG4gICAgICAgICAgICBkaXJzID0gZGlyLmJpbmRpbmcuZGlyc1xuICAgICAgICAgICAgaWYgKGRpcnMpIGRpcnMuc3BsaWNlKGRpcnMuaW5kZXhPZihkaXIpLCAxKVxuICAgICAgICB9XG4gICAgICAgIGRpci51bmJpbmQoKVxuICAgIH1cblxuICAgIC8vIHVuYmluZCBhbGwgZXhwcmVzc2lvbnMgKGFub255bW91cyBiaW5kaW5ncylcbiAgICBpID0gZXhwcy5sZW5ndGhcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGV4cHNbaV0udW5iaW5kKClcbiAgICB9XG5cbiAgICAvLyB1bmJpbmQgYWxsIG93biBiaW5kaW5nc1xuICAgIGZvciAoa2V5IGluIGJpbmRpbmdzKSB7XG4gICAgICAgIGJpbmRpbmcgPSBiaW5kaW5nc1trZXldXG4gICAgICAgIGlmIChiaW5kaW5nKSB7XG4gICAgICAgICAgICBiaW5kaW5nLnVuYmluZCgpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgc2VsZiBmcm9tIHBhcmVudENvbXBpbGVyXG4gICAgdmFyIHBhcmVudCA9IGNvbXBpbGVyLnBhcmVudENvbXBpbGVyLFxuICAgICAgICBjaGlsZElkID0gY29tcGlsZXIuY2hpbGRJZFxuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgcGFyZW50LmNoaWxkQ29tcGlsZXJzLnNwbGljZShwYXJlbnQuY2hpbGRDb21waWxlcnMuaW5kZXhPZihjb21waWxlciksIDEpXG4gICAgICAgIGlmIChjaGlsZElkKSB7XG4gICAgICAgICAgICBkZWxldGUgcGFyZW50LnZtLiRbY2hpbGRJZF1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZpbmFsbHkgcmVtb3ZlIGRvbSBlbGVtZW50XG4gICAgaWYgKGVsID09PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgIGVsLmlubmVySFRNTCA9ICcnXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdm0uJHJlbW92ZSgpXG4gICAgfVxuXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlXG4gICAgLy8gZW1pdCBkZXN0cm95IGhvb2tcbiAgICBjb21waWxlci5leGVjSG9vaygnYWZ0ZXJEZXN0cm95JylcblxuICAgIC8vIGZpbmFsbHksIHVucmVnaXN0ZXIgYWxsIGxpc3RlbmVyc1xuICAgIGNvbXBpbGVyLm9ic2VydmVyLm9mZigpXG4gICAgY29tcGlsZXIuZW1pdHRlci5vZmYoKVxufVxuXG4vLyBIZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogIHNob3J0aGFuZCBmb3IgZ2V0dGluZyByb290IGNvbXBpbGVyXG4gKi9cbmZ1bmN0aW9uIGdldFJvb3QgKGNvbXBpbGVyKSB7XG4gICAgd2hpbGUgKGNvbXBpbGVyLnBhcmVudENvbXBpbGVyKSB7XG4gICAgICAgIGNvbXBpbGVyID0gY29tcGlsZXIucGFyZW50Q29tcGlsZXJcbiAgICB9XG4gICAgcmV0dXJuIGNvbXBpbGVyXG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ29tcGlsZXIiLCJ2YXIgcHJlZml4ID0gJ3YnLFxuICAgIHNwZWNpYWxBdHRyaWJ1dGVzID0gW1xuICAgICAgICAncHJlJyxcbiAgICAgICAgJ3JlZicsXG4gICAgICAgICd3aXRoJyxcbiAgICAgICAgJ3RleHQnLFxuICAgICAgICAncmVwZWF0JyxcbiAgICAgICAgJ3BhcnRpYWwnLFxuICAgICAgICAnY29tcG9uZW50JyxcbiAgICAgICAgJ3RyYW5zaXRpb24nXG4gICAgXSxcbiAgICBjb25maWcgPSBtb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgICAgICBkZWJ1ZyAgICAgICA6IGZhbHNlLFxuICAgICAgICBzaWxlbnQgICAgICA6IGZhbHNlLFxuICAgICAgICBlbnRlckNsYXNzICA6ICd2LWVudGVyJyxcbiAgICAgICAgbGVhdmVDbGFzcyAgOiAndi1sZWF2ZScsXG4gICAgICAgIGF0dHJzICAgICAgIDoge30sXG5cbiAgICAgICAgZ2V0IHByZWZpeCAoKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZml4XG4gICAgICAgIH0sXG4gICAgICAgIHNldCBwcmVmaXggKHZhbCkge1xuICAgICAgICAgICAgcHJlZml4ID0gdmFsXG4gICAgICAgICAgICB1cGRhdGVQcmVmaXgoKVxuICAgICAgICB9XG4gICAgICAgIFxuICAgIH1cblxuZnVuY3Rpb24gdXBkYXRlUHJlZml4ICgpIHtcbiAgICBzcGVjaWFsQXR0cmlidXRlcy5mb3JFYWNoKGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICAgIGNvbmZpZy5hdHRyc1thdHRyXSA9IHByZWZpeCArICctJyArIGF0dHJcbiAgICB9KVxufVxuXG51cGRhdGVQcmVmaXgoKSIsInZhciBFbWl0dGVyICA9IHJlcXVpcmUoJy4vZW1pdHRlcicpLFxuICAgIHV0aWxzICAgID0gcmVxdWlyZSgnLi91dGlscycpLFxuICAgIE9ic2VydmVyID0gcmVxdWlyZSgnLi9vYnNlcnZlcicpLFxuICAgIGNhdGNoZXIgID0gbmV3IEVtaXR0ZXIoKVxuXG4vKipcbiAqICBBdXRvLWV4dHJhY3QgdGhlIGRlcGVuZGVuY2llcyBvZiBhIGNvbXB1dGVkIHByb3BlcnR5XG4gKiAgYnkgcmVjb3JkaW5nIHRoZSBnZXR0ZXJzIHRyaWdnZXJlZCB3aGVuIGV2YWx1YXRpbmcgaXQuXG4gKi9cbmZ1bmN0aW9uIGNhdGNoRGVwcyAoYmluZGluZykge1xuICAgIGlmIChiaW5kaW5nLmlzRm4pIHJldHVyblxuICAgIHV0aWxzLmxvZygnXFxuLSAnICsgYmluZGluZy5rZXkpXG4gICAgdmFyIGdvdCA9IHV0aWxzLmhhc2goKVxuICAgIGJpbmRpbmcuZGVwcyA9IFtdXG4gICAgY2F0Y2hlci5vbignZ2V0JywgZnVuY3Rpb24gKGRlcCkge1xuICAgICAgICB2YXIgaGFzID0gZ290W2RlcC5rZXldXG4gICAgICAgIGlmIChoYXMgJiYgaGFzLmNvbXBpbGVyID09PSBkZXAuY29tcGlsZXIpIHJldHVyblxuICAgICAgICBnb3RbZGVwLmtleV0gPSBkZXBcbiAgICAgICAgdXRpbHMubG9nKCcgIC0gJyArIGRlcC5rZXkpXG4gICAgICAgIGJpbmRpbmcuZGVwcy5wdXNoKGRlcClcbiAgICAgICAgZGVwLnN1YnMucHVzaChiaW5kaW5nKVxuICAgIH0pXG4gICAgYmluZGluZy52YWx1ZS4kZ2V0KClcbiAgICBjYXRjaGVyLm9mZignZ2V0Jylcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiAgdGhlIG9ic2VydmVyIHRoYXQgY2F0Y2hlcyBldmVudHMgdHJpZ2dlcmVkIGJ5IGdldHRlcnNcbiAgICAgKi9cbiAgICBjYXRjaGVyOiBjYXRjaGVyLFxuXG4gICAgLyoqXG4gICAgICogIHBhcnNlIGEgbGlzdCBvZiBjb21wdXRlZCBwcm9wZXJ0eSBiaW5kaW5nc1xuICAgICAqL1xuICAgIHBhcnNlOiBmdW5jdGlvbiAoYmluZGluZ3MpIHtcbiAgICAgICAgdXRpbHMubG9nKCdcXG5wYXJzaW5nIGRlcGVuZGVuY2llcy4uLicpXG4gICAgICAgIE9ic2VydmVyLnNob3VsZEdldCA9IHRydWVcbiAgICAgICAgYmluZGluZ3MuZm9yRWFjaChjYXRjaERlcHMpXG4gICAgICAgIE9ic2VydmVyLnNob3VsZEdldCA9IGZhbHNlXG4gICAgICAgIHV0aWxzLmxvZygnXFxuZG9uZS4nKVxuICAgIH1cbiAgICBcbn0iLCJ2YXIgdXRpbHMgICAgICA9IHJlcXVpcmUoJy4vdXRpbHMnKSxcbiAgICBkaXJlY3RpdmVzID0gcmVxdWlyZSgnLi9kaXJlY3RpdmVzJyksXG4gICAgZmlsdGVycyAgICA9IHJlcXVpcmUoJy4vZmlsdGVycycpLFxuXG4gICAgLy8gUmVnZXhlcyFcblxuICAgIC8vIHJlZ2V4IHRvIHNwbGl0IG11bHRpcGxlIGRpcmVjdGl2ZSBleHByZXNzaW9uc1xuICAgIC8vIHNwbGl0IGJ5IGNvbW1hcywgYnV0IGlnbm9yZSBjb21tYXMgd2l0aGluIHF1b3RlcywgcGFyZW5zIGFuZCBlc2NhcGVzLlxuICAgIFNQTElUX1JFICAgICAgICA9IC8oPzpbJ1wiXSg/OlxcXFwufFteJ1wiXSkqWydcIl18XFwoKD86XFxcXC58W15cXCldKSpcXCl8XFxcXC58W14sXSkrL2csXG5cbiAgICAvLyBtYXRjaCB1cCB0byB0aGUgZmlyc3Qgc2luZ2xlIHBpcGUsIGlnbm9yZSB0aG9zZSB3aXRoaW4gcXVvdGVzLlxuICAgIEtFWV9SRSAgICAgICAgICA9IC9eKD86WydcIl0oPzpcXFxcLnxbXidcIl0pKlsnXCJdfFxcXFwufFteXFx8XXxcXHxcXHwpKy8sXG5cbiAgICBBUkdfUkUgICAgICAgICAgPSAvXihbXFx3LSQgXSspOiguKykkLyxcbiAgICBGSUxURVJTX1JFICAgICAgPSAvXFx8W15cXHxdKy9nLFxuICAgIEZJTFRFUl9UT0tFTl9SRSA9IC9bXlxccyddK3wnW14nXSsnL2csXG4gICAgTkVTVElOR19SRSAgICAgID0gL15cXCQocGFyZW50fHJvb3QpXFwuLyxcbiAgICBTSU5HTEVfVkFSX1JFICAgPSAvXltcXHdcXC4kXSskL1xuXG4vKipcbiAqICBEaXJlY3RpdmUgY2xhc3NcbiAqICByZXByZXNlbnRzIGEgc2luZ2xlIGRpcmVjdGl2ZSBpbnN0YW5jZSBpbiB0aGUgRE9NXG4gKi9cbmZ1bmN0aW9uIERpcmVjdGl2ZSAoZGVmaW5pdGlvbiwgZXhwcmVzc2lvbiwgcmF3S2V5LCBjb21waWxlciwgbm9kZSkge1xuXG4gICAgdGhpcy5jb21waWxlciA9IGNvbXBpbGVyXG4gICAgdGhpcy52bSAgICAgICA9IGNvbXBpbGVyLnZtXG4gICAgdGhpcy5lbCAgICAgICA9IG5vZGVcblxuICAgIHZhciBpc0VtcHR5ICA9IGV4cHJlc3Npb24gPT09ICcnXG5cbiAgICAvLyBtaXggaW4gcHJvcGVydGllcyBmcm9tIHRoZSBkaXJlY3RpdmUgZGVmaW5pdGlvblxuICAgIGlmICh0eXBlb2YgZGVmaW5pdGlvbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzW2lzRW1wdHkgPyAnYmluZCcgOiAnX3VwZGF0ZSddID0gZGVmaW5pdGlvblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gZGVmaW5pdGlvbikge1xuICAgICAgICAgICAgaWYgKHByb3AgPT09ICd1bmJpbmQnIHx8IHByb3AgPT09ICd1cGRhdGUnKSB7XG4gICAgICAgICAgICAgICAgdGhpc1snXycgKyBwcm9wXSA9IGRlZmluaXRpb25bcHJvcF1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpc1twcm9wXSA9IGRlZmluaXRpb25bcHJvcF1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGVtcHR5IGV4cHJlc3Npb24sIHdlJ3JlIGRvbmUuXG4gICAgaWYgKGlzRW1wdHkpIHtcbiAgICAgICAgdGhpcy5pc0VtcHR5ID0gdHJ1ZVxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB0aGlzLmV4cHJlc3Npb24gPSBleHByZXNzaW9uLnRyaW0oKVxuICAgIHRoaXMucmF3S2V5ICAgICA9IHJhd0tleVxuICAgIFxuICAgIHBhcnNlS2V5KHRoaXMsIHJhd0tleSlcblxuICAgIHRoaXMuaXNFeHAgPSAhU0lOR0xFX1ZBUl9SRS50ZXN0KHRoaXMua2V5KSB8fCBORVNUSU5HX1JFLnRlc3QodGhpcy5rZXkpXG4gICAgXG4gICAgdmFyIGZpbHRlckV4cHMgPSB0aGlzLmV4cHJlc3Npb24uc2xpY2UocmF3S2V5Lmxlbmd0aCkubWF0Y2goRklMVEVSU19SRSlcbiAgICBpZiAoZmlsdGVyRXhwcykge1xuICAgICAgICB0aGlzLmZpbHRlcnMgPSBbXVxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGZpbHRlckV4cHMubGVuZ3RoLCBmaWx0ZXI7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGZpbHRlciA9IHBhcnNlRmlsdGVyKGZpbHRlckV4cHNbaV0sIHRoaXMuY29tcGlsZXIpXG4gICAgICAgICAgICBpZiAoZmlsdGVyKSB0aGlzLmZpbHRlcnMucHVzaChmaWx0ZXIpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmZpbHRlcnMubGVuZ3RoKSB0aGlzLmZpbHRlcnMgPSBudWxsXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5maWx0ZXJzID0gbnVsbFxuICAgIH1cbn1cblxudmFyIERpclByb3RvID0gRGlyZWN0aXZlLnByb3RvdHlwZVxuXG4vKipcbiAqICBwYXJzZSBhIGtleSwgZXh0cmFjdCBhcmd1bWVudCBhbmQgbmVzdGluZy9yb290IGluZm9cbiAqL1xuZnVuY3Rpb24gcGFyc2VLZXkgKGRpciwgcmF3S2V5KSB7XG4gICAgdmFyIGtleSA9IHJhd0tleVxuICAgIGlmIChyYXdLZXkuaW5kZXhPZignOicpID4gLTEpIHtcbiAgICAgICAgdmFyIGFyZ01hdGNoID0gcmF3S2V5Lm1hdGNoKEFSR19SRSlcbiAgICAgICAga2V5ID0gYXJnTWF0Y2hcbiAgICAgICAgICAgID8gYXJnTWF0Y2hbMl0udHJpbSgpXG4gICAgICAgICAgICA6IGtleVxuICAgICAgICBkaXIuYXJnID0gYXJnTWF0Y2hcbiAgICAgICAgICAgID8gYXJnTWF0Y2hbMV0udHJpbSgpXG4gICAgICAgICAgICA6IG51bGxcbiAgICB9XG4gICAgZGlyLmtleSA9IGtleVxufVxuXG4vKipcbiAqICBwYXJzZSBhIGZpbHRlciBleHByZXNzaW9uXG4gKi9cbmZ1bmN0aW9uIHBhcnNlRmlsdGVyIChmaWx0ZXIsIGNvbXBpbGVyKSB7XG5cbiAgICB2YXIgdG9rZW5zID0gZmlsdGVyLnNsaWNlKDEpLm1hdGNoKEZJTFRFUl9UT0tFTl9SRSlcbiAgICBpZiAoIXRva2VucykgcmV0dXJuXG4gICAgdG9rZW5zID0gdG9rZW5zLm1hcChmdW5jdGlvbiAodG9rZW4pIHtcbiAgICAgICAgcmV0dXJuIHRva2VuLnJlcGxhY2UoLycvZywgJycpLnRyaW0oKVxuICAgIH0pXG5cbiAgICB2YXIgbmFtZSA9IHRva2Vuc1swXSxcbiAgICAgICAgYXBwbHkgPSBjb21waWxlci5nZXRPcHRpb24oJ2ZpbHRlcnMnLCBuYW1lKSB8fCBmaWx0ZXJzW25hbWVdXG4gICAgaWYgKCFhcHBseSkge1xuICAgICAgICB1dGlscy53YXJuKCdVbmtub3duIGZpbHRlcjogJyArIG5hbWUpXG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIG5hbWUgIDogbmFtZSxcbiAgICAgICAgYXBwbHkgOiBhcHBseSxcbiAgICAgICAgYXJncyAgOiB0b2tlbnMubGVuZ3RoID4gMVxuICAgICAgICAgICAgICAgID8gdG9rZW5zLnNsaWNlKDEpXG4gICAgICAgICAgICAgICAgOiBudWxsXG4gICAgfVxufVxuXG4vKipcbiAqICBjYWxsZWQgd2hlbiBhIG5ldyB2YWx1ZSBpcyBzZXQgXG4gKiAgZm9yIGNvbXB1dGVkIHByb3BlcnRpZXMsIHRoaXMgd2lsbCBvbmx5IGJlIGNhbGxlZCBvbmNlXG4gKiAgZHVyaW5nIGluaXRpYWxpemF0aW9uLlxuICovXG5EaXJQcm90by51cGRhdGUgPSBmdW5jdGlvbiAodmFsdWUsIGluaXQpIHtcbiAgICB2YXIgdHlwZSA9IHV0aWxzLnR5cGVPZih2YWx1ZSlcbiAgICBpZiAoaW5pdCB8fCB2YWx1ZSAhPT0gdGhpcy52YWx1ZSB8fCB0eXBlID09PSAnT2JqZWN0JyB8fCB0eXBlID09PSAnQXJyYXknKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZVxuICAgICAgICBpZiAodGhpcy5fdXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGUoXG4gICAgICAgICAgICAgICAgdGhpcy5maWx0ZXJzXG4gICAgICAgICAgICAgICAgICAgID8gdGhpcy5hcHBseUZpbHRlcnModmFsdWUpXG4gICAgICAgICAgICAgICAgICAgIDogdmFsdWVcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiAgcGlwZSB0aGUgdmFsdWUgdGhyb3VnaCBmaWx0ZXJzXG4gKi9cbkRpclByb3RvLmFwcGx5RmlsdGVycyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHZhciBmaWx0ZXJlZCA9IHZhbHVlLCBmaWx0ZXJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuZmlsdGVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgZmlsdGVyID0gdGhpcy5maWx0ZXJzW2ldXG4gICAgICAgIGZpbHRlcmVkID0gZmlsdGVyLmFwcGx5LmNhbGwodGhpcy52bSwgZmlsdGVyZWQsIGZpbHRlci5hcmdzKVxuICAgIH1cbiAgICByZXR1cm4gZmlsdGVyZWRcbn1cblxuLyoqXG4gKiAgVW5iaW5kIGRpcmV0aXZlXG4gKi9cbkRpclByb3RvLnVuYmluZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyB0aGlzIGNhbiBiZSBjYWxsZWQgYmVmb3JlIHRoZSBlbCBpcyBldmVuIGFzc2lnbmVkLi4uXG4gICAgaWYgKCF0aGlzLmVsIHx8ICF0aGlzLnZtKSByZXR1cm5cbiAgICBpZiAodGhpcy5fdW5iaW5kKSB0aGlzLl91bmJpbmQoKVxuICAgIHRoaXMudm0gPSB0aGlzLmVsID0gdGhpcy5iaW5kaW5nID0gdGhpcy5jb21waWxlciA9IG51bGxcbn1cblxuLy8gZXhwb3NlZCBtZXRob2RzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqICBzcGxpdCBhIHVucXVvdGVkLWNvbW1hIHNlcGFyYXRlZCBleHByZXNzaW9uIGludG9cbiAqICBtdWx0aXBsZSBjbGF1c2VzXG4gKi9cbkRpcmVjdGl2ZS5zcGxpdCA9IGZ1bmN0aW9uIChleHApIHtcbiAgICByZXR1cm4gZXhwLmluZGV4T2YoJywnKSA+IC0xXG4gICAgICAgID8gZXhwLm1hdGNoKFNQTElUX1JFKSB8fCBbJyddXG4gICAgICAgIDogW2V4cF1cbn1cblxuLyoqXG4gKiAgbWFrZSBzdXJlIHRoZSBkaXJlY3RpdmUgYW5kIGV4cHJlc3Npb24gaXMgdmFsaWRcbiAqICBiZWZvcmUgd2UgY3JlYXRlIGFuIGluc3RhbmNlXG4gKi9cbkRpcmVjdGl2ZS5wYXJzZSA9IGZ1bmN0aW9uIChkaXJuYW1lLCBleHByZXNzaW9uLCBjb21waWxlciwgbm9kZSkge1xuXG4gICAgdmFyIGRpciA9IGNvbXBpbGVyLmdldE9wdGlvbignZGlyZWN0aXZlcycsIGRpcm5hbWUpIHx8IGRpcmVjdGl2ZXNbZGlybmFtZV1cbiAgICBpZiAoIWRpcikgcmV0dXJuIHV0aWxzLndhcm4oJ3Vua25vd24gZGlyZWN0aXZlOiAnICsgZGlybmFtZSlcblxuICAgIHZhciByYXdLZXlcbiAgICBpZiAoZXhwcmVzc2lvbi5pbmRleE9mKCd8JykgPiAtMSkge1xuICAgICAgICB2YXIga2V5TWF0Y2ggPSBleHByZXNzaW9uLm1hdGNoKEtFWV9SRSlcbiAgICAgICAgaWYgKGtleU1hdGNoKSB7XG4gICAgICAgICAgICByYXdLZXkgPSBrZXlNYXRjaFswXS50cmltKClcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJhd0tleSA9IGV4cHJlc3Npb24udHJpbSgpXG4gICAgfVxuICAgIFxuICAgIC8vIGhhdmUgYSB2YWxpZCByYXcga2V5LCBvciBiZSBhbiBlbXB0eSBkaXJlY3RpdmVcbiAgICByZXR1cm4gKHJhd0tleSB8fCBleHByZXNzaW9uID09PSAnJylcbiAgICAgICAgPyBuZXcgRGlyZWN0aXZlKGRpciwgZXhwcmVzc2lvbiwgcmF3S2V5LCBjb21waWxlciwgbm9kZSlcbiAgICAgICAgOiB1dGlscy53YXJuKCdpbnZhbGlkIGRpcmVjdGl2ZSBleHByZXNzaW9uOiAnICsgZXhwcmVzc2lvbilcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBEaXJlY3RpdmUiLCJ2YXIgdG9UZXh0ID0gcmVxdWlyZSgnLi4vdXRpbHMnKS50b1RleHQsXG4gICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2VcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBiaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIGEgY29tbWVudCBub2RlIG1lYW5zIHRoaXMgaXMgYSBiaW5kaW5nIGZvclxuICAgICAgICAvLyB7e3sgaW5saW5lIHVuZXNjYXBlZCBodG1sIH19fVxuICAgICAgICBpZiAodGhpcy5lbC5ub2RlVHlwZSA9PT0gOCkge1xuICAgICAgICAgICAgLy8gaG9sZCBub2Rlc1xuICAgICAgICAgICAgdGhpcy5ob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgICAgICAgICAgdGhpcy5ub2RlcyA9IFtdXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdmFsdWUgPSB0b1RleHQodmFsdWUpXG4gICAgICAgIGlmICh0aGlzLmhvbGRlcikge1xuICAgICAgICAgICAgdGhpcy5zd2FwKHZhbHVlKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5lbC5pbm5lckhUTUwgPSB2YWx1ZVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIHN3YXA6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcy5lbC5wYXJlbnROb2RlLFxuICAgICAgICAgICAgaG9sZGVyID0gdGhpcy5ob2xkZXIsXG4gICAgICAgICAgICBub2RlcyA9IHRoaXMubm9kZXMsXG4gICAgICAgICAgICBpID0gbm9kZXMubGVuZ3RoLCBsXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChub2Rlc1tpXSlcbiAgICAgICAgfVxuICAgICAgICBob2xkZXIuaW5uZXJIVE1MID0gdmFsdWVcbiAgICAgICAgbm9kZXMgPSB0aGlzLm5vZGVzID0gc2xpY2UuY2FsbChob2xkZXIuY2hpbGROb2RlcylcbiAgICAgICAgZm9yIChpID0gMCwgbCA9IG5vZGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5lbClcbiAgICAgICAgfVxuICAgIH1cbn0iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vY29uZmlnJyksXG4gICAgdHJhbnNpdGlvbiA9IHJlcXVpcmUoJy4uL3RyYW5zaXRpb24nKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIGJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5wYXJlbnQgPSB0aGlzLmVsLnBhcmVudE5vZGVcbiAgICAgICAgdGhpcy5yZWYgPSBkb2N1bWVudC5jcmVhdGVDb21tZW50KGNvbmZpZy5wcmVmaXggKyAnLWlmLScgKyB0aGlzLmtleSlcbiAgICAgICAgdGhpcy5lbC52dWVfcmVmID0gdGhpcy5yZWZcbiAgICB9LFxuXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcblxuICAgICAgICB2YXIgZWwgICAgICAgPSB0aGlzLmVsXG5cbiAgICAgICAgaWYgKCF0aGlzLnBhcmVudCkgeyAvLyB0aGUgbm9kZSB3YXMgZGV0YWNoZWQgd2hlbiBib3VuZFxuICAgICAgICAgICAgaWYgKCFlbC5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50ID0gZWwucGFyZW50Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2hvdWxkIGFsd2F5cyBoYXZlIHRoaXMucGFyZW50IGlmIHdlIHJlYWNoIGhlcmVcbiAgICAgICAgdmFyIHBhcmVudCAgID0gdGhpcy5wYXJlbnQsXG4gICAgICAgICAgICByZWYgICAgICA9IHRoaXMucmVmLFxuICAgICAgICAgICAgY29tcGlsZXIgPSB0aGlzLmNvbXBpbGVyXG5cbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbihlbCwgLTEsIHJlbW92ZSwgY29tcGlsZXIpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9uKGVsLCAxLCBpbnNlcnQsIGNvbXBpbGVyKVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcmVtb3ZlICgpIHtcbiAgICAgICAgICAgIGlmICghZWwucGFyZW50Tm9kZSkgcmV0dXJuXG4gICAgICAgICAgICAvLyBpbnNlcnQgdGhlIHJlZmVyZW5jZSBub2RlXG4gICAgICAgICAgICB2YXIgbmV4dCA9IGVsLm5leHRTaWJsaW5nXG4gICAgICAgICAgICBpZiAobmV4dCkge1xuICAgICAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUocmVmLCBuZXh0KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQocmVmKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGVsKVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW5zZXJ0ICgpIHtcbiAgICAgICAgICAgIGlmIChlbC5wYXJlbnROb2RlKSByZXR1cm5cbiAgICAgICAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoZWwsIHJlZilcbiAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChyZWYpXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgdW5iaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZWwudnVlX3JlZiA9IG51bGxcbiAgICB9XG59IiwidmFyIHV0aWxzICAgICAgPSByZXF1aXJlKCcuLi91dGlscycpLFxuICAgIGNvbmZpZyAgICAgPSByZXF1aXJlKCcuLi9jb25maWcnKSxcbiAgICB0cmFuc2l0aW9uID0gcmVxdWlyZSgnLi4vdHJhbnNpdGlvbicpXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgb24gICAgICAgIDogcmVxdWlyZSgnLi9vbicpLFxuICAgIHJlcGVhdCAgICA6IHJlcXVpcmUoJy4vcmVwZWF0JyksXG4gICAgbW9kZWwgICAgIDogcmVxdWlyZSgnLi9tb2RlbCcpLFxuICAgICdpZicgICAgICA6IHJlcXVpcmUoJy4vaWYnKSxcbiAgICAnd2l0aCcgICAgOiByZXF1aXJlKCcuL3dpdGgnKSxcbiAgICBodG1sICAgICAgOiByZXF1aXJlKCcuL2h0bWwnKSxcbiAgICBzdHlsZSAgICAgOiByZXF1aXJlKCcuL3N0eWxlJyksXG5cbiAgICBhdHRyOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlIHx8IHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZSh0aGlzLmFyZywgdmFsdWUpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZSh0aGlzLmFyZylcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICB0ZXh0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5lbC50ZXh0Q29udGVudCA9IHV0aWxzLnRvVGV4dCh2YWx1ZSlcbiAgICB9LFxuXG4gICAgc2hvdzogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHZhciBlbCA9IHRoaXMuZWwsXG4gICAgICAgICAgICB0YXJnZXQgPSB2YWx1ZSA/ICcnIDogJ25vbmUnLFxuICAgICAgICAgICAgY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGVsLnN0eWxlLmRpc3BsYXkgPSB0YXJnZXRcbiAgICAgICAgICAgIH1cbiAgICAgICAgdHJhbnNpdGlvbihlbCwgdmFsdWUgPyAxIDogLTEsIGNoYW5nZSwgdGhpcy5jb21waWxlcilcbiAgICB9LFxuXG4gICAgJ2NsYXNzJzogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmFyZykge1xuICAgICAgICAgICAgdXRpbHNbdmFsdWUgPyAnYWRkQ2xhc3MnIDogJ3JlbW92ZUNsYXNzJ10odGhpcy5lbCwgdGhpcy5hcmcpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXN0VmFsKSB7XG4gICAgICAgICAgICAgICAgdXRpbHMucmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5sYXN0VmFsKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdXRpbHMuYWRkQ2xhc3ModGhpcy5lbCwgdmFsdWUpXG4gICAgICAgICAgICAgICAgdGhpcy5sYXN0VmFsID0gdmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBjbG9hazoge1xuICAgICAgICBiaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgZWwgPSB0aGlzLmVsXG4gICAgICAgICAgICB0aGlzLmNvbXBpbGVyLm9ic2VydmVyLm9uY2UoJ2hvb2s6cmVhZHknLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKGNvbmZpZy5wcmVmaXggKyAnLWNsb2FrJylcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9XG5cbn0iLCJ2YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpLFxuICAgIGlzSUU5ID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdNU0lFIDkuMCcpID4gMFxuXG4vKipcbiAqICBSZXR1cm5zIGFuIGFycmF5IG9mIHZhbHVlcyBmcm9tIGEgbXVsdGlwbGUgc2VsZWN0XG4gKi9cbmZ1bmN0aW9uIGdldE11bHRpcGxlU2VsZWN0T3B0aW9ucyAoc2VsZWN0KSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5maWx0ZXJcbiAgICAgICAgLmNhbGwoc2VsZWN0Lm9wdGlvbnMsIGZ1bmN0aW9uIChvcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24uc2VsZWN0ZWRcbiAgICAgICAgfSlcbiAgICAgICAgLm1hcChmdW5jdGlvbiAob3B0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLnZhbHVlIHx8IG9wdGlvbi50ZXh0XG4gICAgICAgIH0pXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgYmluZDogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIGVsICAgPSBzZWxmLmVsLFxuICAgICAgICAgICAgdHlwZSA9IGVsLnR5cGUsXG4gICAgICAgICAgICB0YWcgID0gZWwudGFnTmFtZVxuXG4gICAgICAgIHNlbGYubG9jayA9IGZhbHNlXG5cbiAgICAgICAgLy8gZGV0ZXJtaW5lIHdoYXQgZXZlbnQgdG8gbGlzdGVuIHRvXG4gICAgICAgIHNlbGYuZXZlbnQgPVxuICAgICAgICAgICAgKHNlbGYuY29tcGlsZXIub3B0aW9ucy5sYXp5IHx8XG4gICAgICAgICAgICB0YWcgPT09ICdTRUxFQ1QnIHx8XG4gICAgICAgICAgICB0eXBlID09PSAnY2hlY2tib3gnIHx8IHR5cGUgPT09ICdyYWRpbycpXG4gICAgICAgICAgICAgICAgPyAnY2hhbmdlJ1xuICAgICAgICAgICAgICAgIDogJ2lucHV0J1xuXG4gICAgICAgIC8vIGRldGVybWluZSB0aGUgYXR0cmlidXRlIHRvIGNoYW5nZSB3aGVuIHVwZGF0aW5nXG4gICAgICAgIHNlbGYuYXR0ciA9IHR5cGUgPT09ICdjaGVja2JveCdcbiAgICAgICAgICAgID8gJ2NoZWNrZWQnXG4gICAgICAgICAgICA6ICh0YWcgPT09ICdJTlBVVCcgfHwgdGFnID09PSAnU0VMRUNUJyB8fCB0YWcgPT09ICdURVhUQVJFQScpXG4gICAgICAgICAgICAgICAgPyAndmFsdWUnXG4gICAgICAgICAgICAgICAgOiAnaW5uZXJIVE1MJ1xuXG4gICAgICAgIC8vIHNlbGVjdFttdWx0aXBsZV0gc3VwcG9ydFxuICAgICAgICBpZih0YWcgPT09ICdTRUxFQ1QnICYmIGVsLmhhc0F0dHJpYnV0ZSgnbXVsdGlwbGUnKSkge1xuICAgICAgICAgICAgdGhpcy5tdWx0aSA9IHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb21wb3NpdGlvbkxvY2sgPSBmYWxzZVxuICAgICAgICBzZWxmLmNMb2NrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29tcG9zaXRpb25Mb2NrID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIHNlbGYuY1VubG9jayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbXBvc2l0aW9uTG9jayA9IGZhbHNlXG4gICAgICAgIH1cbiAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY29tcG9zaXRpb25zdGFydCcsIHRoaXMuY0xvY2spXG4gICAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbXBvc2l0aW9uZW5kJywgdGhpcy5jVW5sb2NrKVxuXG4gICAgICAgIC8vIGF0dGFjaCBsaXN0ZW5lclxuICAgICAgICBzZWxmLnNldCA9IHNlbGYuZmlsdGVyc1xuICAgICAgICAgICAgPyBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvc2l0aW9uTG9jaykgcmV0dXJuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBkaXJlY3RpdmUgaGFzIGZpbHRlcnNcbiAgICAgICAgICAgICAgICAvLyB3ZSBuZWVkIHRvIGxldCB0aGUgdm0uJHNldCB0cmlnZ2VyXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlKCkgc28gZmlsdGVycyBhcmUgYXBwbGllZC5cbiAgICAgICAgICAgICAgICAvLyB0aGVyZWZvcmUgd2UgaGF2ZSB0byByZWNvcmQgY3Vyc29yIHBvc2l0aW9uXG4gICAgICAgICAgICAgICAgLy8gc28gdGhhdCBhZnRlciB2bS4kc2V0IGNoYW5nZXMgdGhlIGlucHV0XG4gICAgICAgICAgICAgICAgLy8gdmFsdWUgd2UgY2FuIHB1dCB0aGUgY3Vyc29yIGJhY2sgYXQgd2hlcmUgaXQgaXNcbiAgICAgICAgICAgICAgICB2YXIgY3Vyc29yUG9zXG4gICAgICAgICAgICAgICAgdHJ5IHsgY3Vyc29yUG9zID0gZWwuc2VsZWN0aW9uU3RhcnQgfSBjYXRjaCAoZSkge31cblxuICAgICAgICAgICAgICAgIHNlbGYuX3NldCgpXG5cbiAgICAgICAgICAgICAgICAvLyBzaW5jZSB1cGRhdGVzIGFyZSBhc3luY1xuICAgICAgICAgICAgICAgIC8vIHdlIG5lZWQgdG8gcmVzZXQgY3Vyc29yIHBvc2l0aW9uIGFzeW5jIHRvb1xuICAgICAgICAgICAgICAgIHV0aWxzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnNvclBvcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbC5zZXRTZWxlY3Rpb25SYW5nZShjdXJzb3JQb3MsIGN1cnNvclBvcylcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9zaXRpb25Mb2NrKSByZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBubyBmaWx0ZXJzLCBkb24ndCBsZXQgaXQgdHJpZ2dlciB1cGRhdGUoKVxuICAgICAgICAgICAgICAgIHNlbGYubG9jayA9IHRydWVcblxuICAgICAgICAgICAgICAgIHNlbGYuX3NldCgpXG5cbiAgICAgICAgICAgICAgICB1dGlscy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYubG9jayA9IGZhbHNlXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcihzZWxmLmV2ZW50LCBzZWxmLnNldClcblxuICAgICAgICAvLyBmaXggc2hpdCBmb3IgSUU5XG4gICAgICAgIC8vIHNpbmNlIGl0IGRvZXNuJ3QgZmlyZSBpbnB1dCBvbiBiYWNrc3BhY2UgLyBkZWwgLyBjdXRcbiAgICAgICAgaWYgKGlzSUU5KSB7XG4gICAgICAgICAgICBzZWxmLm9uQ3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vIGN1dCBldmVudCBmaXJlcyBiZWZvcmUgdGhlIHZhbHVlIGFjdHVhbGx5IGNoYW5nZXNcbiAgICAgICAgICAgICAgICB1dGlscy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0KClcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VsZi5vbkRlbCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gNDYgfHwgZS5rZXlDb2RlID09PSA4KSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0KClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjdXQnLCBzZWxmLm9uQ3V0KVxuICAgICAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBzZWxmLm9uRGVsKVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9zZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy52bS4kc2V0KFxuICAgICAgICAgICAgdGhpcy5rZXksIHRoaXMubXVsdGlcbiAgICAgICAgICAgICAgICA/IGdldE11bHRpcGxlU2VsZWN0T3B0aW9ucyh0aGlzLmVsKVxuICAgICAgICAgICAgICAgIDogdGhpcy5lbFt0aGlzLmF0dHJdXG4gICAgICAgIClcbiAgICB9LFxuXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLyoganNoaW50IGVxZXFlcTogZmFsc2UgKi9cbiAgICAgICAgaWYgKHRoaXMubG9jaykgcmV0dXJuXG4gICAgICAgIHZhciBlbCA9IHRoaXMuZWxcbiAgICAgICAgaWYgKGVsLnRhZ05hbWUgPT09ICdTRUxFQ1QnKSB7IC8vIHNlbGVjdCBkcm9wZG93blxuICAgICAgICAgICAgZWwuc2VsZWN0ZWRJbmRleCA9IC0xXG4gICAgICAgICAgICBpZih0aGlzLm11bHRpICYmIEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUuZm9yRWFjaCh0aGlzLnVwZGF0ZVNlbGVjdCwgdGhpcylcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTZWxlY3QodmFsdWUpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZWwudHlwZSA9PT0gJ3JhZGlvJykgeyAvLyByYWRpbyBidXR0b25cbiAgICAgICAgICAgIGVsLmNoZWNrZWQgPSB2YWx1ZSA9PSBlbC52YWx1ZVxuICAgICAgICB9IGVsc2UgaWYgKGVsLnR5cGUgPT09ICdjaGVja2JveCcpIHsgLy8gY2hlY2tib3hcbiAgICAgICAgICAgIGVsLmNoZWNrZWQgPSAhIXZhbHVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbFt0aGlzLmF0dHJdID0gdXRpbHMudG9UZXh0KHZhbHVlKVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIHVwZGF0ZVNlbGVjdDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIC8qIGpzaGludCBlcWVxZXE6IGZhbHNlICovXG4gICAgICAgIC8vIHNldHRpbmcgPHNlbGVjdD4ncyB2YWx1ZSBpbiBJRTkgZG9lc24ndCB3b3JrXG4gICAgICAgIC8vIHdlIGhhdmUgdG8gbWFudWFsbHkgbG9vcCB0aHJvdWdoIHRoZSBvcHRpb25zXG4gICAgICAgIHZhciBvcHRpb25zID0gdGhpcy5lbC5vcHRpb25zLFxuICAgICAgICAgICAgaSA9IG9wdGlvbnMubGVuZ3RoXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zW2ldLnZhbHVlID09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9uc1tpXS5zZWxlY3RlZCA9IHRydWVcbiAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIHVuYmluZDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZWwgPSB0aGlzLmVsXG4gICAgICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcy5ldmVudCwgdGhpcy5zZXQpXG4gICAgICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NvbXBvc2l0aW9uc3RhcnQnLCB0aGlzLmNMb2NrKVxuICAgICAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCdjb21wb3NpdGlvbmVuZCcsIHRoaXMuY1VubG9jaylcbiAgICAgICAgaWYgKGlzSUU5KSB7XG4gICAgICAgICAgICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCdjdXQnLCB0aGlzLm9uQ3V0KVxuICAgICAgICAgICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLm9uRGVsKVxuICAgICAgICB9XG4gICAgfVxufSIsInZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJylcblxuZnVuY3Rpb24gZGVsZWdhdGVDaGVjayAoZWwsIHJvb3QsIGlkZW50aWZpZXIpIHtcbiAgICB3aGlsZSAoZWwgJiYgZWwgIT09IHJvb3QpIHtcbiAgICAgICAgaWYgKGVsW2lkZW50aWZpZXJdKSByZXR1cm4gZWxcbiAgICAgICAgZWwgPSBlbC5wYXJlbnROb2RlXG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIGlzRm46IHRydWUsXG5cbiAgICBiaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbXBpbGVyLnJlcGVhdCkge1xuICAgICAgICAgICAgLy8gYXR0YWNoIGFuIGlkZW50aWZpZXIgdG8gdGhlIGVsXG4gICAgICAgICAgICAvLyBzbyBpdCBjYW4gYmUgbWF0Y2hlZCBkdXJpbmcgZXZlbnQgZGVsZWdhdGlvblxuICAgICAgICAgICAgdGhpcy5lbFt0aGlzLmV4cHJlc3Npb25dID0gdHJ1ZVxuICAgICAgICAgICAgLy8gYXR0YWNoIHRoZSBvd25lciB2aWV3bW9kZWwgb2YgdGhpcyBkaXJlY3RpdmVcbiAgICAgICAgICAgIHRoaXMuZWwudnVlX3ZpZXdtb2RlbCA9IHRoaXMudm1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChoYW5kbGVyKSB7XG4gICAgICAgIHRoaXMucmVzZXQoKVxuICAgICAgICBpZiAodHlwZW9mIGhhbmRsZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlscy53YXJuKCdEaXJlY3RpdmUgXCJvblwiIGV4cGVjdHMgYSBmdW5jdGlvbiB2YWx1ZS4nKVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbXBpbGVyID0gdGhpcy5jb21waWxlcixcbiAgICAgICAgICAgIGV2ZW50ICAgID0gdGhpcy5hcmcsXG4gICAgICAgICAgICBpc0V4cCAgICA9IHRoaXMuYmluZGluZy5pc0V4cCxcbiAgICAgICAgICAgIG93bmVyVk0gID0gdGhpcy5iaW5kaW5nLmNvbXBpbGVyLnZtXG5cbiAgICAgICAgaWYgKGNvbXBpbGVyLnJlcGVhdCAmJlxuICAgICAgICAgICAgLy8gZG8gbm90IGRlbGVnYXRlIGlmIHRoZSByZXBlYXQgaXMgY29tYmluZWQgd2l0aCBhbiBleHRlbmRlZCBWTVxuICAgICAgICAgICAgIXRoaXMudm0uY29uc3RydWN0b3Iuc3VwZXIgJiZcbiAgICAgICAgICAgIC8vIGJsdXIgYW5kIGZvY3VzIGV2ZW50cyBkbyBub3QgYnViYmxlXG4gICAgICAgICAgICBldmVudCAhPT0gJ2JsdXInICYmIGV2ZW50ICE9PSAnZm9jdXMnKSB7XG5cbiAgICAgICAgICAgIC8vIGZvciBlYWNoIGJsb2NrcywgZGVsZWdhdGUgZm9yIGJldHRlciBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgLy8gZm9jdXMgYW5kIGJsdXIgZXZlbnRzIGRvbnQgYnViYmxlIHNvIGV4Y2x1ZGUgdGhlbVxuICAgICAgICAgICAgdmFyIGRlbGVnYXRvciAgPSBjb21waWxlci5kZWxlZ2F0b3IsXG4gICAgICAgICAgICAgICAgaWRlbnRpZmllciA9IHRoaXMuZXhwcmVzc2lvbixcbiAgICAgICAgICAgICAgICBkSGFuZGxlciAgID0gZGVsZWdhdG9yLnZ1ZV9kSGFuZGxlcnNbaWRlbnRpZmllcl1cblxuICAgICAgICAgICAgaWYgKGRIYW5kbGVyKSByZXR1cm5cblxuICAgICAgICAgICAgLy8gdGhlIGZvbGxvd2luZyBvbmx5IGdldHMgcnVuIG9uY2UgZm9yIHRoZSBlbnRpcmUgZWFjaCBibG9ja1xuICAgICAgICAgICAgZEhhbmRsZXIgPSBkZWxlZ2F0b3IudnVlX2RIYW5kbGVyc1tpZGVudGlmaWVyXSA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGRlbGVnYXRlQ2hlY2soZS50YXJnZXQsIGRlbGVnYXRvciwgaWRlbnRpZmllcilcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIGUuZWwgPSB0YXJnZXRcbiAgICAgICAgICAgICAgICAgICAgZS50YXJnZXRWTSA9IHRhcmdldC52dWVfdmlld21vZGVsXG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXIuY2FsbChpc0V4cCA/IGUudGFyZ2V0Vk0gOiBvd25lclZNLCBlKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRIYW5kbGVyLmV2ZW50ID0gZXZlbnRcbiAgICAgICAgICAgIGRlbGVnYXRvci5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBkSGFuZGxlcilcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBhIG5vcm1hbCwgc2luZ2xlIGVsZW1lbnQgaGFuZGxlclxuICAgICAgICAgICAgdmFyIHZtID0gdGhpcy52bVxuICAgICAgICAgICAgdGhpcy5oYW5kbGVyID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICBlLmVsID0gZS5jdXJyZW50VGFyZ2V0XG4gICAgICAgICAgICAgICAgZS50YXJnZXRWTSA9IHZtXG4gICAgICAgICAgICAgICAgaGFuZGxlci5jYWxsKG93bmVyVk0sIGUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIHRoaXMuaGFuZGxlcilcblxuICAgICAgICB9XG4gICAgfSxcblxuICAgIHJlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLmFyZywgdGhpcy5oYW5kbGVyKVxuICAgICAgICB0aGlzLmhhbmRsZXIgPSBudWxsXG4gICAgfSxcblxuICAgIHVuYmluZDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlc2V0KClcbiAgICAgICAgdGhpcy5lbC52dWVfdmlld21vZGVsID0gbnVsbFxuICAgIH1cbn0iLCJ2YXIgT2JzZXJ2ZXIgICA9IHJlcXVpcmUoJy4uL29ic2VydmVyJyksXG4gICAgdXRpbHMgICAgICA9IHJlcXVpcmUoJy4uL3V0aWxzJyksXG4gICAgY29uZmlnICAgICA9IHJlcXVpcmUoJy4uL2NvbmZpZycpLFxuICAgIHRyYW5zaXRpb24gPSByZXF1aXJlKCcuLi90cmFuc2l0aW9uJyksXG4gICAgVmlld01vZGVsIC8vIGxhenkgZGVmIHRvIGF2b2lkIGNpcmN1bGFyIGRlcGVuZGVuY3lcblxuLyoqXG4gKiAgTWF0aG9kcyB0aGF0IHBlcmZvcm0gcHJlY2lzZSBET00gbWFuaXB1bGF0aW9uXG4gKiAgYmFzZWQgb24gbXV0YXRvciBtZXRob2QgdHJpZ2dlcmVkXG4gKi9cbnZhciBtdXRhdGlvbkhhbmRsZXJzID0ge1xuXG4gICAgcHVzaDogZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgdmFyIGksIGwgPSBtLmFyZ3MubGVuZ3RoLFxuICAgICAgICAgICAgYmFzZSA9IHRoaXMuY29sbGVjdGlvbi5sZW5ndGggLSBsXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYnVpbGRJdGVtKG0uYXJnc1tpXSwgYmFzZSArIGkpXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgcG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciB2bSA9IHRoaXMudm1zLnBvcCgpXG4gICAgICAgIGlmICh2bSkgdm0uJGRlc3Ryb3koKVxuICAgIH0sXG5cbiAgICB1bnNoaWZ0OiBmdW5jdGlvbiAobSkge1xuICAgICAgICBtLmFyZ3MuZm9yRWFjaCh0aGlzLmJ1aWxkSXRlbSwgdGhpcylcbiAgICB9LFxuXG4gICAgc2hpZnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHZtID0gdGhpcy52bXMuc2hpZnQoKVxuICAgICAgICBpZiAodm0pIHZtLiRkZXN0cm95KClcbiAgICB9LFxuXG4gICAgc3BsaWNlOiBmdW5jdGlvbiAobSkge1xuICAgICAgICB2YXIgaSwgbCxcbiAgICAgICAgICAgIGluZGV4ID0gbS5hcmdzWzBdLFxuICAgICAgICAgICAgcmVtb3ZlZCA9IG0uYXJnc1sxXSxcbiAgICAgICAgICAgIGFkZGVkID0gbS5hcmdzLmxlbmd0aCAtIDIsXG4gICAgICAgICAgICByZW1vdmVkVk1zID0gdGhpcy52bXMuc3BsaWNlKGluZGV4LCByZW1vdmVkKVxuICAgICAgICBmb3IgKGkgPSAwLCBsID0gcmVtb3ZlZFZNcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHJlbW92ZWRWTXNbaV0uJGRlc3Ryb3koKVxuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBhZGRlZDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmJ1aWxkSXRlbShtLmFyZ3NbaSArIDJdLCBpbmRleCArIGkpXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc29ydDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdm1zID0gdGhpcy52bXMsXG4gICAgICAgICAgICBjb2wgPSB0aGlzLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICBsID0gY29sLmxlbmd0aCxcbiAgICAgICAgICAgIHNvcnRlZCA9IG5ldyBBcnJheShsKSxcbiAgICAgICAgICAgIGksIGosIHZtLCBkYXRhXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGRhdGEgPSBjb2xbaV1cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBsOyBqKyspIHtcbiAgICAgICAgICAgICAgICB2bSA9IHZtc1tqXVxuICAgICAgICAgICAgICAgIGlmICh2bS4kZGF0YSA9PT0gZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBzb3J0ZWRbaV0gPSB2bVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRhaW5lci5pbnNlcnRCZWZvcmUoc29ydGVkW2ldLiRlbCwgdGhpcy5yZWYpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy52bXMgPSBzb3J0ZWRcbiAgICB9LFxuXG4gICAgcmV2ZXJzZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdm1zID0gdGhpcy52bXNcbiAgICAgICAgdm1zLnJldmVyc2UoKVxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHZtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuY29udGFpbmVyLmluc2VydEJlZm9yZSh2bXNbaV0uJGVsLCB0aGlzLnJlZilcbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICBiaW5kOiBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgdmFyIGVsICAgPSB0aGlzLmVsLFxuICAgICAgICAgICAgY3RuICA9IHRoaXMuY29udGFpbmVyID0gZWwucGFyZW50Tm9kZVxuXG4gICAgICAgIC8vIGV4dHJhY3QgY2hpbGQgVk0gaW5mb3JtYXRpb24sIGlmIGFueVxuICAgICAgICBWaWV3TW9kZWwgPSBWaWV3TW9kZWwgfHwgcmVxdWlyZSgnLi4vdmlld21vZGVsJylcbiAgICAgICAgdGhpcy5DdG9yID0gdGhpcy5DdG9yIHx8IFZpZXdNb2RlbFxuICAgICAgICAvLyBleHRyYWN0IHRyYW5zaXRpb24gaW5mb3JtYXRpb25cbiAgICAgICAgdGhpcy5oYXNUcmFucyA9IGVsLmhhc0F0dHJpYnV0ZShjb25maWcuYXR0cnMudHJhbnNpdGlvbilcbiAgICAgICAgLy8gZXh0cmFjdCBjaGlsZCBJZCwgaWYgYW55XG4gICAgICAgIHRoaXMuY2hpbGRJZCA9IHV0aWxzLmF0dHIoZWwsICdyZWYnKVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhIGNvbW1lbnQgbm9kZSBhcyBhIHJlZmVyZW5jZSBub2RlIGZvciBET00gaW5zZXJ0aW9uc1xuICAgICAgICB0aGlzLnJlZiA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoY29uZmlnLnByZWZpeCArICctcmVwZWF0LScgKyB0aGlzLmtleSlcbiAgICAgICAgY3RuLmluc2VydEJlZm9yZSh0aGlzLnJlZiwgZWwpXG4gICAgICAgIGN0bi5yZW1vdmVDaGlsZChlbClcblxuICAgICAgICB0aGlzLmluaXRpYXRlZCA9IGZhbHNlXG4gICAgICAgIHRoaXMuY29sbGVjdGlvbiA9IG51bGxcbiAgICAgICAgdGhpcy52bXMgPSBudWxsXG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgICAgIHRoaXMubXV0YXRpb25MaXN0ZW5lciA9IGZ1bmN0aW9uIChwYXRoLCBhcnIsIG11dGF0aW9uKSB7XG4gICAgICAgICAgICB2YXIgbWV0aG9kID0gbXV0YXRpb24ubWV0aG9kXG4gICAgICAgICAgICBtdXRhdGlvbkhhbmRsZXJzW21ldGhvZF0uY2FsbChzZWxmLCBtdXRhdGlvbilcbiAgICAgICAgICAgIGlmIChtZXRob2QgIT09ICdwdXNoJyAmJiBtZXRob2QgIT09ICdwb3AnKSB7XG4gICAgICAgICAgICAgICAgdmFyIGkgPSBhcnIubGVuZ3RoXG4gICAgICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgICAgICBhcnJbaV0uJGluZGV4ID0gaVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtZXRob2QgPT09ICdwdXNoJyB8fCBtZXRob2QgPT09ICd1bnNoaWZ0JyB8fCBtZXRob2QgPT09ICdzcGxpY2UnKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5jaGFuZ2VkKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfSxcblxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKGNvbGxlY3Rpb24sIGluaXQpIHtcbiAgICAgICAgXG4gICAgICAgIGlmIChjb2xsZWN0aW9uID09PSB0aGlzLmNvbGxlY3Rpb24pIHJldHVyblxuXG4gICAgICAgIHRoaXMucmVzZXQoKVxuICAgICAgICAvLyBhdHRhY2ggYW4gb2JqZWN0IHRvIGNvbnRhaW5lciB0byBob2xkIGhhbmRsZXJzXG4gICAgICAgIHRoaXMuY29udGFpbmVyLnZ1ZV9kSGFuZGxlcnMgPSB1dGlscy5oYXNoKClcbiAgICAgICAgLy8gaWYgaW5pdGlhdGluZyB3aXRoIGFuIGVtcHR5IGNvbGxlY3Rpb24sIHdlIG5lZWQgdG9cbiAgICAgICAgLy8gZm9yY2UgYSBjb21waWxlIHNvIHRoYXQgd2UgZ2V0IGFsbCB0aGUgYmluZGluZ3MgZm9yXG4gICAgICAgIC8vIGRlcGVuZGVuY3kgZXh0cmFjdGlvbi5cbiAgICAgICAgaWYgKCF0aGlzLmluaXRpYXRlZCAmJiAoIWNvbGxlY3Rpb24gfHwgIWNvbGxlY3Rpb24ubGVuZ3RoKSkge1xuICAgICAgICAgICAgdGhpcy5idWlsZEl0ZW0oKVxuICAgICAgICAgICAgdGhpcy5pbml0aWF0ZWQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgY29sbGVjdGlvbiA9IHRoaXMuY29sbGVjdGlvbiA9IGNvbGxlY3Rpb24gfHwgW11cbiAgICAgICAgdGhpcy52bXMgPSBbXVxuICAgICAgICBpZiAodGhpcy5jaGlsZElkKSB7XG4gICAgICAgICAgICB0aGlzLnZtLiRbdGhpcy5jaGlsZElkXSA9IHRoaXMudm1zXG4gICAgICAgIH1cblxuICAgICAgICAvLyBsaXN0ZW4gZm9yIGNvbGxlY3Rpb24gbXV0YXRpb24gZXZlbnRzXG4gICAgICAgIC8vIHRoZSBjb2xsZWN0aW9uIGhhcyBiZWVuIGF1Z21lbnRlZCBkdXJpbmcgQmluZGluZy5zZXQoKVxuICAgICAgICBpZiAoIWNvbGxlY3Rpb24uX19vYnNlcnZlcl9fKSBPYnNlcnZlci53YXRjaEFycmF5KGNvbGxlY3Rpb24pXG4gICAgICAgIGNvbGxlY3Rpb24uX19vYnNlcnZlcl9fLm9uKCdtdXRhdGUnLCB0aGlzLm11dGF0aW9uTGlzdGVuZXIpXG5cbiAgICAgICAgLy8gY3JlYXRlIGNoaWxkLXZtcyBhbmQgYXBwZW5kIHRvIERPTVxuICAgICAgICBpZiAoY29sbGVjdGlvbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb24uZm9yRWFjaCh0aGlzLmJ1aWxkSXRlbSwgdGhpcylcbiAgICAgICAgICAgIGlmICghaW5pdCkgdGhpcy5jaGFuZ2VkKClcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgTm90aWZ5IHBhcmVudCBjb21waWxlciB0aGF0IG5ldyBpdGVtc1xuICAgICAqICBoYXZlIGJlZW4gYWRkZWQgdG8gdGhlIGNvbGxlY3Rpb24sIGl0IG5lZWRzXG4gICAgICogIHRvIHJlLWNhbGN1bGF0ZSBjb21wdXRlZCBwcm9wZXJ0eSBkZXBlbmRlbmNpZXMuXG4gICAgICogIEJhdGNoZWQgdG8gZW5zdXJlIGl0J3MgY2FsbGVkIG9ubHkgb25jZSBldmVyeSBldmVudCBsb29wLlxuICAgICAqL1xuICAgIGNoYW5nZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMucXVldWVkKSByZXR1cm5cbiAgICAgICAgdGhpcy5xdWV1ZWQgPSB0cnVlXG4gICAgICAgIHZhciBzZWxmID0gdGhpc1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghc2VsZi5jb21waWxlcikgcmV0dXJuXG4gICAgICAgICAgICBzZWxmLmNvbXBpbGVyLnBhcnNlRGVwcygpXG4gICAgICAgICAgICBzZWxmLnF1ZXVlZCA9IGZhbHNlXG4gICAgICAgIH0sIDApXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqICBDcmVhdGUgYSBuZXcgY2hpbGQgVk0gZnJvbSBhIGRhdGEgb2JqZWN0XG4gICAgICogIHBhc3NpbmcgYWxvbmcgY29tcGlsZXIgb3B0aW9ucyBpbmRpY2F0aW5nIHRoaXNcbiAgICAgKiAgaXMgYSB2LXJlcGVhdCBpdGVtLlxuICAgICAqL1xuICAgIGJ1aWxkSXRlbTogZnVuY3Rpb24gKGRhdGEsIGluZGV4KSB7XG5cbiAgICAgICAgdmFyIGVsICA9IHRoaXMuZWwuY2xvbmVOb2RlKHRydWUpLFxuICAgICAgICAgICAgY3RuID0gdGhpcy5jb250YWluZXIsXG4gICAgICAgICAgICB2bXMgPSB0aGlzLnZtcyxcbiAgICAgICAgICAgIGNvbCA9IHRoaXMuY29sbGVjdGlvbixcbiAgICAgICAgICAgIHJlZiwgaXRlbSwgcHJpbWl0aXZlXG5cbiAgICAgICAgLy8gYXBwZW5kIG5vZGUgaW50byBET00gZmlyc3RcbiAgICAgICAgLy8gc28gdi1pZiBjYW4gZ2V0IGFjY2VzcyB0byBwYXJlbnROb2RlXG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICByZWYgPSB2bXMubGVuZ3RoID4gaW5kZXhcbiAgICAgICAgICAgICAgICA/IHZtc1tpbmRleF0uJGVsXG4gICAgICAgICAgICAgICAgOiB0aGlzLnJlZlxuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIGl0IHdvcmtzIHdpdGggdi1pZlxuICAgICAgICAgICAgaWYgKCFyZWYucGFyZW50Tm9kZSkgcmVmID0gcmVmLnZ1ZV9yZWZcbiAgICAgICAgICAgIC8vIHByb2Nlc3MgdHJhbnNpdGlvbiBpbmZvIGJlZm9yZSBhcHBlbmRpbmdcbiAgICAgICAgICAgIGVsLnZ1ZV90cmFucyA9IHV0aWxzLmF0dHIoZWwsICd0cmFuc2l0aW9uJywgdHJ1ZSlcbiAgICAgICAgICAgIHRyYW5zaXRpb24oZWwsIDEsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjdG4uaW5zZXJ0QmVmb3JlKGVsLCByZWYpXG4gICAgICAgICAgICB9LCB0aGlzLmNvbXBpbGVyKVxuICAgICAgICAgICAgLy8gd3JhcCBwcmltaXRpdmUgZWxlbWVudCBpbiBhbiBvYmplY3RcbiAgICAgICAgICAgIGlmICh1dGlscy50eXBlT2YoZGF0YSkgIT09ICdPYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcHJpbWl0aXZlID0gdHJ1ZVxuICAgICAgICAgICAgICAgIGRhdGEgPSB7IHZhbHVlOiBkYXRhIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGl0ZW0gPSBuZXcgdGhpcy5DdG9yKHtcbiAgICAgICAgICAgIGVsOiBlbCxcbiAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICBjb21waWxlck9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICByZXBlYXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgcmVwZWF0SW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgIHBhcmVudENvbXBpbGVyOiB0aGlzLmNvbXBpbGVyLFxuICAgICAgICAgICAgICAgIGRlbGVnYXRvcjogY3RuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgICAvLyB0aGlzIGlzIGEgZm9yY2VkIGNvbXBpbGUgZm9yIGFuIGVtcHR5IGNvbGxlY3Rpb24uXG4gICAgICAgICAgICAvLyBsZXQncyByZW1vdmUgaXQuLi5cbiAgICAgICAgICAgIGl0ZW0uJGRlc3Ryb3koKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdm1zLnNwbGljZShpbmRleCwgMCwgaXRlbSlcbiAgICAgICAgICAgIC8vIGZvciBwcmltaXRpdmUgdmFsdWVzLCBsaXN0ZW4gZm9yIHZhbHVlIGNoYW5nZVxuICAgICAgICAgICAgaWYgKHByaW1pdGl2ZSkge1xuICAgICAgICAgICAgICAgIGRhdGEuX19vYnNlcnZlcl9fLm9uKCdzZXQnLCBmdW5jdGlvbiAoa2V5LCB2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleSA9PT0gJ3ZhbHVlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sW2l0ZW0uJGluZGV4XSA9IHZhbFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5jaGlsZElkKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy52bS4kW3RoaXMuY2hpbGRJZF1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5jb2xsZWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb24uX19vYnNlcnZlcl9fLm9mZignbXV0YXRlJywgdGhpcy5tdXRhdGlvbkxpc3RlbmVyKVxuICAgICAgICAgICAgdmFyIGkgPSB0aGlzLnZtcy5sZW5ndGhcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnZtc1tpXS4kZGVzdHJveSgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGN0biA9IHRoaXMuY29udGFpbmVyLFxuICAgICAgICAgICAgaGFuZGxlcnMgPSBjdG4udnVlX2RIYW5kbGVyc1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gaGFuZGxlcnMpIHtcbiAgICAgICAgICAgIGN0bi5yZW1vdmVFdmVudExpc3RlbmVyKGhhbmRsZXJzW2tleV0uZXZlbnQsIGhhbmRsZXJzW2tleV0pXG4gICAgICAgIH1cbiAgICAgICAgY3RuLnZ1ZV9kSGFuZGxlcnMgPSBudWxsXG4gICAgfSxcblxuICAgIHVuYmluZDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlc2V0KClcbiAgICB9XG59IiwidmFyIGNhbWVsUkUgPSAvLShbYS16XSkvZyxcbiAgICBwcmVmaXhlcyA9IFsnd2Via2l0JywgJ21veicsICdtcyddXG5cbmZ1bmN0aW9uIGNhbWVsUmVwbGFjZXIgKG0pIHtcbiAgICByZXR1cm4gbVsxXS50b1VwcGVyQ2FzZSgpXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgYmluZDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcHJvcCA9IHRoaXMuYXJnLFxuICAgICAgICAgICAgZmlyc3QgPSBwcm9wLmNoYXJBdCgwKVxuICAgICAgICBpZiAoZmlyc3QgPT09ICckJykge1xuICAgICAgICAgICAgLy8gcHJvcGVydGllcyB0aGF0IHN0YXJ0IHdpdGggJCB3aWxsIGJlIGF1dG8tcHJlZml4ZWRcbiAgICAgICAgICAgIHByb3AgPSBwcm9wLnNsaWNlKDEpXG4gICAgICAgICAgICB0aGlzLnByZWZpeGVkID0gdHJ1ZVxuICAgICAgICB9IGVsc2UgaWYgKGZpcnN0ID09PSAnLScpIHtcbiAgICAgICAgICAgIC8vIG5vcm1hbCBzdGFydGluZyBoeXBoZW5zIHNob3VsZCBub3QgYmUgY29udmVydGVkXG4gICAgICAgICAgICBwcm9wID0gcHJvcC5zbGljZSgxKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucHJvcCA9IHByb3AucmVwbGFjZShjYW1lbFJFLCBjYW1lbFJlcGxhY2VyKVxuICAgIH0sXG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgcHJvcCA9IHRoaXMucHJvcFxuICAgICAgICB0aGlzLmVsLnN0eWxlW3Byb3BdID0gdmFsdWVcbiAgICAgICAgaWYgKHRoaXMucHJlZml4ZWQpIHtcbiAgICAgICAgICAgIHByb3AgPSBwcm9wLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcHJvcC5zbGljZSgxKVxuICAgICAgICAgICAgdmFyIGkgPSBwcmVmaXhlcy5sZW5ndGhcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVsLnN0eWxlW3ByZWZpeGVzW2ldICsgcHJvcF0gPSB2YWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG59IiwidmFyIFZpZXdNb2RlbFxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIGJpbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNFbXB0eSkge1xuICAgICAgICAgICAgdGhpcy5idWlsZCgpXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvbXBvbmVudCkge1xuICAgICAgICAgICAgdGhpcy5idWlsZCh2YWx1ZSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY29tcG9uZW50LiRkYXRhID0gdmFsdWVcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBidWlsZDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIFZpZXdNb2RlbCA9IFZpZXdNb2RlbCB8fCByZXF1aXJlKCcuLi92aWV3bW9kZWwnKVxuICAgICAgICB2YXIgQ3RvciA9IHRoaXMuQ3RvciB8fCBWaWV3TW9kZWxcbiAgICAgICAgdGhpcy5jb21wb25lbnQgPSBuZXcgQ3Rvcih7XG4gICAgICAgICAgICBlbDogdGhpcy5lbCxcbiAgICAgICAgICAgIGRhdGE6IHZhbHVlLFxuICAgICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgcGFyZW50Q29tcGlsZXI6IHRoaXMuY29tcGlsZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9LFxuXG4gICAgdW5iaW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuY29tcG9uZW50LiRkZXN0cm95KClcbiAgICB9XG5cbn0iLCIvLyBzaGl2IHRvIG1ha2UgdGhpcyB3b3JrIGZvciBDb21wb25lbnQsIEJyb3dzZXJpZnkgYW5kIE5vZGUgYXQgdGhlIHNhbWUgdGltZS5cbnZhciBFbWl0dGVyLFxuICAgIGNvbXBvbmVudEVtaXR0ZXIgPSAnZW1pdHRlcidcblxudHJ5IHtcbiAgICAvLyBSZXF1aXJpbmcgd2l0aG91dCBhIHN0cmluZyBsaXRlcmFsIHdpbGwgbWFrZSBicm93c2VyaWZ5XG4gICAgLy8gdW5hYmxlIHRvIHBhcnNlIHRoZSBkZXBlbmRlbmN5LCB0aHVzIHByZXZlbnRpbmcgaXQgZnJvbVxuICAgIC8vIHN0b3BwaW5nIHRoZSBjb21waWxhdGlvbiBhZnRlciBhIGZhaWxlZCBsb29rdXAuXG4gICAgRW1pdHRlciA9IHJlcXVpcmUoY29tcG9uZW50RW1pdHRlcilcbn0gY2F0Y2ggKGUpIHtcbiAgICBFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyXG4gICAgRW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbWV0aG9kID0gYXJndW1lbnRzLmxlbmd0aCA+IDFcbiAgICAgICAgICAgID8gdGhpcy5yZW1vdmVMaXN0ZW5lclxuICAgICAgICAgICAgOiB0aGlzLnJlbW92ZUFsbExpc3RlbmVyc1xuICAgICAgICByZXR1cm4gbWV0aG9kLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRW1pdHRlciIsInZhciB1dGlscyAgICAgICAgICAgPSByZXF1aXJlKCcuL3V0aWxzJyksXG4gICAgc3RyaW5nU2F2ZVJFICAgID0gL1wiKD86W15cIlxcXFxdfFxcXFwuKSpcInwnKD86W14nXFxcXF18XFxcXC4pKicvZyxcbiAgICBzdHJpbmdSZXN0b3JlUkUgPSAvXCIoXFxkKylcIi9nLFxuICAgIGNvbnN0cnVjdG9yUkUgICA9IG5ldyBSZWdFeHAoJ2NvbnN0cnVjdG9yJy5zcGxpdCgnJykuam9pbignW1xcJ1wiKywgXSonKSksXG4gICAgdW5pY29kZVJFICAgICAgID0gL1xcXFx1XFxkXFxkXFxkXFxkL1xuXG4vLyBWYXJpYWJsZSBleHRyYWN0aW9uIHNjb29wZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vUnVieUxvdXZyZS9hdmFsb25cblxudmFyIEtFWVdPUkRTID1cbiAgICAgICAgLy8ga2V5d29yZHNcbiAgICAgICAgJ2JyZWFrLGNhc2UsY2F0Y2gsY29udGludWUsZGVidWdnZXIsZGVmYXVsdCxkZWxldGUsZG8sZWxzZSxmYWxzZScgK1xuICAgICAgICAnLGZpbmFsbHksZm9yLGZ1bmN0aW9uLGlmLGluLGluc3RhbmNlb2YsbmV3LG51bGwscmV0dXJuLHN3aXRjaCx0aGlzJyArXG4gICAgICAgICcsdGhyb3csdHJ1ZSx0cnksdHlwZW9mLHZhcix2b2lkLHdoaWxlLHdpdGgsdW5kZWZpbmVkJyArXG4gICAgICAgIC8vIHJlc2VydmVkXG4gICAgICAgICcsYWJzdHJhY3QsYm9vbGVhbixieXRlLGNoYXIsY2xhc3MsY29uc3QsZG91YmxlLGVudW0sZXhwb3J0LGV4dGVuZHMnICtcbiAgICAgICAgJyxmaW5hbCxmbG9hdCxnb3RvLGltcGxlbWVudHMsaW1wb3J0LGludCxpbnRlcmZhY2UsbG9uZyxuYXRpdmUnICtcbiAgICAgICAgJyxwYWNrYWdlLHByaXZhdGUscHJvdGVjdGVkLHB1YmxpYyxzaG9ydCxzdGF0aWMsc3VwZXIsc3luY2hyb25pemVkJyArXG4gICAgICAgICcsdGhyb3dzLHRyYW5zaWVudCx2b2xhdGlsZScgK1xuICAgICAgICAvLyBFQ01BIDUgLSB1c2Ugc3RyaWN0XG4gICAgICAgICcsYXJndW1lbnRzLGxldCx5aWVsZCcgK1xuICAgICAgICAvLyBhbGxvdyB1c2luZyBNYXRoIGluIGV4cHJlc3Npb25zXG4gICAgICAgICcsTWF0aCcsXG4gICAgICAgIFxuICAgIEtFWVdPUkRTX1JFID0gbmV3IFJlZ0V4cChbXCJcXFxcYlwiICsgS0VZV09SRFMucmVwbGFjZSgvLC9nLCAnXFxcXGJ8XFxcXGInKSArIFwiXFxcXGJcIl0uam9pbignfCcpLCAnZycpLFxuICAgIFJFTU9WRV9SRSAgID0gL1xcL1xcKig/Oi58XFxuKSo/XFwqXFwvfFxcL1xcL1teXFxuXSpcXG58XFwvXFwvW15cXG5dKiR8J1teJ10qJ3xcIlteXCJdKlwifFtcXHNcXHRcXG5dKlxcLltcXHNcXHRcXG5dKlskXFx3XFwuXSsvZyxcbiAgICBTUExJVF9SRSAgICA9IC9bXlxcdyRdKy9nLFxuICAgIE5VTUJFUl9SRSAgID0gL1xcYlxcZFteLF0qL2csXG4gICAgQk9VTkRBUllfUkUgPSAvXiwrfCwrJC9nXG5cbi8qKlxuICogIFN0cmlwIHRvcCBsZXZlbCB2YXJpYWJsZSBuYW1lcyBmcm9tIGEgc25pcHBldCBvZiBKUyBleHByZXNzaW9uXG4gKi9cbmZ1bmN0aW9uIGdldFZhcmlhYmxlcyAoY29kZSkge1xuICAgIGNvZGUgPSBjb2RlXG4gICAgICAgIC5yZXBsYWNlKFJFTU9WRV9SRSwgJycpXG4gICAgICAgIC5yZXBsYWNlKFNQTElUX1JFLCAnLCcpXG4gICAgICAgIC5yZXBsYWNlKEtFWVdPUkRTX1JFLCAnJylcbiAgICAgICAgLnJlcGxhY2UoTlVNQkVSX1JFLCAnJylcbiAgICAgICAgLnJlcGxhY2UoQk9VTkRBUllfUkUsICcnKVxuICAgIHJldHVybiBjb2RlXG4gICAgICAgID8gY29kZS5zcGxpdCgvLCsvKVxuICAgICAgICA6IFtdXG59XG5cbi8qKlxuICogIEEgZ2l2ZW4gcGF0aCBjb3VsZCBwb3RlbnRpYWxseSBleGlzdCBub3Qgb24gdGhlXG4gKiAgY3VycmVudCBjb21waWxlciwgYnV0IHVwIGluIHRoZSBwYXJlbnQgY2hhaW4gc29tZXdoZXJlLlxuICogIFRoaXMgZnVuY3Rpb24gZ2VuZXJhdGVzIGFuIGFjY2VzcyByZWxhdGlvbnNoaXAgc3RyaW5nXG4gKiAgdGhhdCBjYW4gYmUgdXNlZCBpbiB0aGUgZ2V0dGVyIGZ1bmN0aW9uIGJ5IHdhbGtpbmcgdXBcbiAqICB0aGUgcGFyZW50IGNoYWluIHRvIGNoZWNrIGZvciBrZXkgZXhpc3RlbmNlLlxuICpcbiAqICBJdCBzdG9wcyBhdCB0b3AgcGFyZW50IGlmIG5vIHZtIGluIHRoZSBjaGFpbiBoYXMgdGhlXG4gKiAga2V5LiBJdCB0aGVuIGNyZWF0ZXMgYW55IG1pc3NpbmcgYmluZGluZ3Mgb24gdGhlXG4gKiAgZmluYWwgcmVzb2x2ZWQgdm0uXG4gKi9cbmZ1bmN0aW9uIGdldFJlbCAocGF0aCwgY29tcGlsZXIpIHtcbiAgICB2YXIgcmVsICA9ICcnLFxuICAgICAgICBkaXN0ID0gMCxcbiAgICAgICAgc2VsZiA9IGNvbXBpbGVyXG4gICAgd2hpbGUgKGNvbXBpbGVyKSB7XG4gICAgICAgIGlmIChjb21waWxlci5oYXNLZXkocGF0aCkpIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb21waWxlciA9IGNvbXBpbGVyLnBhcmVudENvbXBpbGVyXG4gICAgICAgICAgICBkaXN0KytcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGlsZXIpIHtcbiAgICAgICAgd2hpbGUgKGRpc3QtLSkge1xuICAgICAgICAgICAgcmVsICs9ICckcGFyZW50LidcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvbXBpbGVyLmJpbmRpbmdzW3BhdGhdICYmIHBhdGguY2hhckF0KDApICE9PSAnJCcpIHtcbiAgICAgICAgICAgIGNvbXBpbGVyLmNyZWF0ZUJpbmRpbmcocGF0aClcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuY3JlYXRlQmluZGluZyhwYXRoKVxuICAgIH1cbiAgICByZXR1cm4gcmVsXG59XG5cbi8qKlxuICogIENyZWF0ZSBhIGZ1bmN0aW9uIGZyb20gYSBzdHJpbmcuLi5cbiAqICB0aGlzIGxvb2tzIGxpa2UgZXZpbCBtYWdpYyBidXQgc2luY2UgYWxsIHZhcmlhYmxlcyBhcmUgbGltaXRlZFxuICogIHRvIHRoZSBWTSdzIGRhdGEgaXQncyBhY3R1YWxseSBwcm9wZXJseSBzYW5kYm94ZWRcbiAqL1xuZnVuY3Rpb24gbWFrZUdldHRlciAoZXhwLCByYXcpIHtcbiAgICAvKiBqc2hpbnQgZXZpbDogdHJ1ZSAqL1xuICAgIHZhciBmblxuICAgIHRyeSB7XG4gICAgICAgIGZuID0gbmV3IEZ1bmN0aW9uKGV4cClcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHV0aWxzLndhcm4oJ0ludmFsaWQgZXhwcmVzc2lvbjogJyArIHJhdylcbiAgICB9XG4gICAgcmV0dXJuIGZuXG59XG5cbi8qKlxuICogIEVzY2FwZSBhIGxlYWRpbmcgZG9sbGFyIHNpZ24gZm9yIHJlZ2V4IGNvbnN0cnVjdGlvblxuICovXG5mdW5jdGlvbiBlc2NhcGVEb2xsYXIgKHYpIHtcbiAgICByZXR1cm4gdi5jaGFyQXQoMCkgPT09ICckJ1xuICAgICAgICA/ICdcXFxcJyArIHZcbiAgICAgICAgOiB2XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqXG4gICAgICogIFBhcnNlIGFuZCByZXR1cm4gYW4gYW5vbnltb3VzIGNvbXB1dGVkIHByb3BlcnR5IGdldHRlciBmdW5jdGlvblxuICAgICAqICBmcm9tIGFuIGFyYml0cmFyeSBleHByZXNzaW9uLCB0b2dldGhlciB3aXRoIGEgbGlzdCBvZiBwYXRocyB0byBiZVxuICAgICAqICBjcmVhdGVkIGFzIGJpbmRpbmdzLlxuICAgICAqL1xuICAgIHBhcnNlOiBmdW5jdGlvbiAoZXhwLCBjb21waWxlcikge1xuICAgICAgICAvLyB1bmljb2RlIGFuZCAnY29uc3RydWN0b3InIGFyZSBub3QgYWxsb3dlZCBmb3IgWFNTIHNlY3VyaXR5LlxuICAgICAgICBpZiAodW5pY29kZVJFLnRlc3QoZXhwKSB8fCBjb25zdHJ1Y3RvclJFLnRlc3QoZXhwKSkge1xuICAgICAgICAgICAgdXRpbHMud2FybignVW5zYWZlIGV4cHJlc3Npb246ICcgKyBleHApXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge31cbiAgICAgICAgfVxuICAgICAgICAvLyBleHRyYWN0IHZhcmlhYmxlIG5hbWVzXG4gICAgICAgIHZhciB2YXJzID0gZ2V0VmFyaWFibGVzKGV4cClcbiAgICAgICAgaWYgKCF2YXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIG1ha2VHZXR0ZXIoJ3JldHVybiAnICsgZXhwLCBleHApXG4gICAgICAgIH1cbiAgICAgICAgdmFycyA9IHV0aWxzLnVuaXF1ZSh2YXJzKVxuICAgICAgICB2YXIgYWNjZXNzb3JzID0gJycsXG4gICAgICAgICAgICBoYXMgICAgICAgPSB1dGlscy5oYXNoKCksXG4gICAgICAgICAgICBzdHJpbmdzICAgPSBbXSxcbiAgICAgICAgICAgIC8vIGNvbnN0cnVjdCBhIHJlZ2V4IHRvIGV4dHJhY3QgYWxsIHZhbGlkIHZhcmlhYmxlIHBhdGhzXG4gICAgICAgICAgICAvLyBvbmVzIHRoYXQgYmVnaW4gd2l0aCBcIiRcIiBhcmUgcGFydGljdWxhcmx5IHRyaWNreVxuICAgICAgICAgICAgLy8gYmVjYXVzZSB3ZSBjYW4ndCB1c2UgXFxiIGZvciB0aGVtXG4gICAgICAgICAgICBwYXRoUkUgPSBuZXcgUmVnRXhwKFxuICAgICAgICAgICAgICAgIFwiW14kXFxcXHdcXFxcLl0oXCIgK1xuICAgICAgICAgICAgICAgIHZhcnMubWFwKGVzY2FwZURvbGxhcikuam9pbignfCcpICtcbiAgICAgICAgICAgICAgICBcIilbJFxcXFx3XFxcXC5dKlxcXFxiXCIsICdnJ1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGJvZHkgPSAoJ3JldHVybiAnICsgZXhwKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKHN0cmluZ1NhdmVSRSwgc2F2ZVN0cmluZ3MpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aFJFLCByZXBsYWNlUGF0aClcbiAgICAgICAgICAgICAgICAucmVwbGFjZShzdHJpbmdSZXN0b3JlUkUsIHJlc3RvcmVTdHJpbmdzKVxuICAgICAgICBib2R5ID0gYWNjZXNzb3JzICsgYm9keVxuXG4gICAgICAgIGZ1bmN0aW9uIHNhdmVTdHJpbmdzIChzdHIpIHtcbiAgICAgICAgICAgIHZhciBpID0gc3RyaW5ncy5sZW5ndGhcbiAgICAgICAgICAgIHN0cmluZ3NbaV0gPSBzdHJcbiAgICAgICAgICAgIHJldHVybiAnXCInICsgaSArICdcIidcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJlcGxhY2VQYXRoIChwYXRoKSB7XG4gICAgICAgICAgICAvLyBrZWVwIHRyYWNrIG9mIHRoZSBmaXJzdCBjaGFyXG4gICAgICAgICAgICB2YXIgYyA9IHBhdGguY2hhckF0KDApXG4gICAgICAgICAgICBwYXRoID0gcGF0aC5zbGljZSgxKVxuICAgICAgICAgICAgdmFyIHZhbCA9ICd0aGlzLicgKyBnZXRSZWwocGF0aCwgY29tcGlsZXIpICsgcGF0aFxuICAgICAgICAgICAgaWYgKCFoYXNbcGF0aF0pIHtcbiAgICAgICAgICAgICAgICBhY2Nlc3NvcnMgKz0gdmFsICsgJzsnXG4gICAgICAgICAgICAgICAgaGFzW3BhdGhdID0gMVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZG9uJ3QgZm9yZ2V0IHRvIHB1dCB0aGF0IGZpcnN0IGNoYXIgYmFja1xuICAgICAgICAgICAgcmV0dXJuIGMgKyB2YWxcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHJlc3RvcmVTdHJpbmdzIChzdHIsIGkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdzW2ldXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbWFrZUdldHRlcihib2R5LCBleHApXG4gICAgfVxufSIsInZhciBrZXlDb2RlcyA9IHtcbiAgICBlbnRlciAgICA6IDEzLFxuICAgIHRhYiAgICAgIDogOSxcbiAgICAnZGVsZXRlJyA6IDQ2LFxuICAgIHVwICAgICAgIDogMzgsXG4gICAgbGVmdCAgICAgOiAzNyxcbiAgICByaWdodCAgICA6IDM5LFxuICAgIGRvd24gICAgIDogNDAsXG4gICAgZXNjICAgICAgOiAyN1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqICAnYWJjJyA9PiAnQWJjJ1xuICAgICAqL1xuICAgIGNhcGl0YWxpemU6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBpZiAoIXZhbHVlICYmIHZhbHVlICE9PSAwKSByZXR1cm4gJydcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS50b1N0cmluZygpXG4gICAgICAgIHJldHVybiB2YWx1ZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHZhbHVlLnNsaWNlKDEpXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqICAnYWJjJyA9PiAnQUJDJ1xuICAgICAqL1xuICAgIHVwcGVyY2FzZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiAodmFsdWUgfHwgdmFsdWUgPT09IDApXG4gICAgICAgICAgICA/IHZhbHVlLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKVxuICAgICAgICAgICAgOiAnJ1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgJ0FiQycgPT4gJ2FiYydcbiAgICAgKi9cbiAgICBsb3dlcmNhc2U6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gKHZhbHVlIHx8IHZhbHVlID09PSAwKVxuICAgICAgICAgICAgPyB2YWx1ZS50b1N0cmluZygpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgICAgIDogJydcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogIDEyMzQ1ID0+ICQxMiwzNDUuMDBcbiAgICAgKi9cbiAgICBjdXJyZW5jeTogZnVuY3Rpb24gKHZhbHVlLCBhcmdzKSB7XG4gICAgICAgIGlmICghdmFsdWUgJiYgdmFsdWUgIT09IDApIHJldHVybiAnJ1xuICAgICAgICB2YXIgc2lnbiA9IChhcmdzICYmIGFyZ3NbMF0pIHx8ICckJyxcbiAgICAgICAgICAgIHMgPSBNYXRoLmZsb29yKHZhbHVlKS50b1N0cmluZygpLFxuICAgICAgICAgICAgaSA9IHMubGVuZ3RoICUgMyxcbiAgICAgICAgICAgIGggPSBpID4gMCA/IChzLnNsaWNlKDAsIGkpICsgKHMubGVuZ3RoID4gMyA/ICcsJyA6ICcnKSkgOiAnJyxcbiAgICAgICAgICAgIGYgPSAnLicgKyB2YWx1ZS50b0ZpeGVkKDIpLnNsaWNlKC0yKVxuICAgICAgICByZXR1cm4gc2lnbiArIGggKyBzLnNsaWNlKGkpLnJlcGxhY2UoLyhcXGR7M30pKD89XFxkKS9nLCAnJDEsJykgKyBmXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqICBhcmdzOiBhbiBhcnJheSBvZiBzdHJpbmdzIGNvcnJlc3BvbmRpbmcgdG9cbiAgICAgKiAgdGhlIHNpbmdsZSwgZG91YmxlLCB0cmlwbGUgLi4uIGZvcm1zIG9mIHRoZSB3b3JkIHRvXG4gICAgICogIGJlIHBsdXJhbGl6ZWQuIFdoZW4gdGhlIG51bWJlciB0byBiZSBwbHVyYWxpemVkXG4gICAgICogIGV4Y2VlZHMgdGhlIGxlbmd0aCBvZiB0aGUgYXJncywgaXQgd2lsbCB1c2UgdGhlIGxhc3RcbiAgICAgKiAgZW50cnkgaW4gdGhlIGFycmF5LlxuICAgICAqXG4gICAgICogIGUuZy4gWydzaW5nbGUnLCAnZG91YmxlJywgJ3RyaXBsZScsICdtdWx0aXBsZSddXG4gICAgICovXG4gICAgcGx1cmFsaXplOiBmdW5jdGlvbiAodmFsdWUsIGFyZ3MpIHtcbiAgICAgICAgcmV0dXJuIGFyZ3MubGVuZ3RoID4gMVxuICAgICAgICAgICAgPyAoYXJnc1t2YWx1ZSAtIDFdIHx8IGFyZ3NbYXJncy5sZW5ndGggLSAxXSlcbiAgICAgICAgICAgIDogKGFyZ3NbdmFsdWUgLSAxXSB8fCBhcmdzWzBdICsgJ3MnKVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgQSBzcGVjaWFsIGZpbHRlciB0aGF0IHRha2VzIGEgaGFuZGxlciBmdW5jdGlvbixcbiAgICAgKiAgd3JhcHMgaXQgc28gaXQgb25seSBnZXRzIHRyaWdnZXJlZCBvbiBzcGVjaWZpYyBrZXlwcmVzc2VzLlxuICAgICAqL1xuICAgIGtleTogZnVuY3Rpb24gKGhhbmRsZXIsIGFyZ3MpIHtcbiAgICAgICAgaWYgKCFoYW5kbGVyKSByZXR1cm5cbiAgICAgICAgdmFyIGNvZGUgPSBrZXlDb2Rlc1thcmdzWzBdXVxuICAgICAgICBpZiAoIWNvZGUpIHtcbiAgICAgICAgICAgIGNvZGUgPSBwYXJzZUludChhcmdzWzBdLCAxMClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGlmIChlLmtleUNvZGUgPT09IGNvZGUpIHtcbiAgICAgICAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0iLCJ2YXIgY29uZmlnICAgICAgPSByZXF1aXJlKCcuL2NvbmZpZycpLFxuICAgIFZpZXdNb2RlbCAgID0gcmVxdWlyZSgnLi92aWV3bW9kZWwnKSxcbiAgICBkaXJlY3RpdmVzICA9IHJlcXVpcmUoJy4vZGlyZWN0aXZlcycpLFxuICAgIGZpbHRlcnMgICAgID0gcmVxdWlyZSgnLi9maWx0ZXJzJyksXG4gICAgdXRpbHMgICAgICAgPSByZXF1aXJlKCcuL3V0aWxzJylcblxuLyoqXG4gKiAgU2V0IGNvbmZpZyBvcHRpb25zXG4gKi9cblZpZXdNb2RlbC5jb25maWcgPSBmdW5jdGlvbiAob3B0cywgdmFsKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAodmFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBjb25maWdbb3B0c11cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbmZpZ1tvcHRzXSA9IHZhbFxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdXRpbHMuZXh0ZW5kKGNvbmZpZywgb3B0cylcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiAgQWxsb3dzIHVzZXIgdG8gcmVnaXN0ZXIvcmV0cmlldmUgYSBkaXJlY3RpdmUgZGVmaW5pdGlvblxuICovXG5WaWV3TW9kZWwuZGlyZWN0aXZlID0gZnVuY3Rpb24gKGlkLCBmbikge1xuICAgIGlmICghZm4pIHJldHVybiBkaXJlY3RpdmVzW2lkXVxuICAgIGRpcmVjdGl2ZXNbaWRdID0gZm5cbiAgICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqICBBbGxvd3MgdXNlciB0byByZWdpc3Rlci9yZXRyaWV2ZSBhIGZpbHRlciBmdW5jdGlvblxuICovXG5WaWV3TW9kZWwuZmlsdGVyID0gZnVuY3Rpb24gKGlkLCBmbikge1xuICAgIGlmICghZm4pIHJldHVybiBmaWx0ZXJzW2lkXVxuICAgIGZpbHRlcnNbaWRdID0gZm5cbiAgICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqICBBbGxvd3MgdXNlciB0byByZWdpc3Rlci9yZXRyaWV2ZSBhIFZpZXdNb2RlbCBjb25zdHJ1Y3RvclxuICovXG5WaWV3TW9kZWwuY29tcG9uZW50ID0gZnVuY3Rpb24gKGlkLCBDdG9yKSB7XG4gICAgaWYgKCFDdG9yKSByZXR1cm4gdXRpbHMuY29tcG9uZW50c1tpZF1cbiAgICB1dGlscy5jb21wb25lbnRzW2lkXSA9IHV0aWxzLnRvQ29uc3RydWN0b3IoQ3RvcilcbiAgICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqICBBbGxvd3MgdXNlciB0byByZWdpc3Rlci9yZXRyaWV2ZSBhIHRlbXBsYXRlIHBhcnRpYWxcbiAqL1xuVmlld01vZGVsLnBhcnRpYWwgPSBmdW5jdGlvbiAoaWQsIHBhcnRpYWwpIHtcbiAgICBpZiAoIXBhcnRpYWwpIHJldHVybiB1dGlscy5wYXJ0aWFsc1tpZF1cbiAgICB1dGlscy5wYXJ0aWFsc1tpZF0gPSB1dGlscy50b0ZyYWdtZW50KHBhcnRpYWwpXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuLyoqXG4gKiAgQWxsb3dzIHVzZXIgdG8gcmVnaXN0ZXIvcmV0cmlldmUgYSB0cmFuc2l0aW9uIGRlZmluaXRpb24gb2JqZWN0XG4gKi9cblZpZXdNb2RlbC50cmFuc2l0aW9uID0gZnVuY3Rpb24gKGlkLCB0cmFuc2l0aW9uKSB7XG4gICAgaWYgKCF0cmFuc2l0aW9uKSByZXR1cm4gdXRpbHMudHJhbnNpdGlvbnNbaWRdXG4gICAgdXRpbHMudHJhbnNpdGlvbnNbaWRdID0gdHJhbnNpdGlvblxuICAgIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogIEV4cG9zZSBpbnRlcm5hbCBtb2R1bGVzIGZvciBwbHVnaW5zXG4gKi9cblZpZXdNb2RlbC5yZXF1aXJlID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICByZXR1cm4gcmVxdWlyZSgnLi8nICsgcGF0aClcbn1cblxuLyoqXG4gKiAgRXhwb3NlIGFuIGludGVyZmFjZSBmb3IgcGx1Z2luc1xuICovXG5WaWV3TW9kZWwudXNlID0gZnVuY3Rpb24gKHBsdWdpbikge1xuICAgIGlmICh0eXBlb2YgcGx1Z2luID09PSAnc3RyaW5nJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcGx1Z2luID0gcmVxdWlyZShwbHVnaW4pXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB1dGlscy53YXJuKCdDYW5ub3QgZmluZCBwbHVnaW46ICcgKyBwbHVnaW4pXG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHR5cGVvZiBwbHVnaW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcGx1Z2luKFZpZXdNb2RlbClcbiAgICB9IGVsc2UgaWYgKHBsdWdpbi5pbnN0YWxsKSB7XG4gICAgICAgIHBsdWdpbi5pbnN0YWxsKFZpZXdNb2RlbClcbiAgICB9XG59XG5cblZpZXdNb2RlbC5leHRlbmQgPSBleHRlbmRcblZpZXdNb2RlbC5uZXh0VGljayA9IHV0aWxzLm5leHRUaWNrXG5cbi8qKlxuICogIEV4cG9zZSB0aGUgbWFpbiBWaWV3TW9kZWwgY2xhc3NcbiAqICBhbmQgYWRkIGV4dGVuZCBtZXRob2RcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kIChvcHRpb25zKSB7XG5cbiAgICB2YXIgUGFyZW50Vk0gPSB0aGlzXG5cbiAgICAvLyBpbmhlcml0IG9wdGlvbnNcbiAgICBvcHRpb25zID0gaW5oZXJpdE9wdGlvbnMob3B0aW9ucywgUGFyZW50Vk0ub3B0aW9ucywgdHJ1ZSlcbiAgICB1dGlscy5wcm9jZXNzT3B0aW9ucyhvcHRpb25zKVxuXG4gICAgdmFyIEV4dGVuZGVkVk0gPSBmdW5jdGlvbiAob3B0cywgYXNQYXJlbnQpIHtcbiAgICAgICAgaWYgKCFhc1BhcmVudCkge1xuICAgICAgICAgICAgb3B0cyA9IGluaGVyaXRPcHRpb25zKG9wdHMsIG9wdGlvbnMsIHRydWUpXG4gICAgICAgIH1cbiAgICAgICAgUGFyZW50Vk0uY2FsbCh0aGlzLCBvcHRzLCB0cnVlKVxuICAgIH1cblxuICAgIC8vIGluaGVyaXQgcHJvdG90eXBlIHByb3BzXG4gICAgdmFyIHByb3RvID0gRXh0ZW5kZWRWTS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFBhcmVudFZNLnByb3RvdHlwZSlcbiAgICB1dGlscy5kZWZQcm90ZWN0ZWQocHJvdG8sICdjb25zdHJ1Y3RvcicsIEV4dGVuZGVkVk0pXG5cbiAgICAvLyBjb3B5IHByb3RvdHlwZSBwcm9wc1xuICAgIHZhciBtZXRob2RzID0gb3B0aW9ucy5tZXRob2RzXG4gICAgaWYgKG1ldGhvZHMpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAhKGtleSBpbiBWaWV3TW9kZWwucHJvdG90eXBlKSAmJlxuICAgICAgICAgICAgICAgIHR5cGVvZiBtZXRob2RzW2tleV0gPT09ICdmdW5jdGlvbidcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHByb3RvW2tleV0gPSBtZXRob2RzW2tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGFsbG93IGV4dGVuZGVkIFZNIHRvIGJlIGZ1cnRoZXIgZXh0ZW5kZWRcbiAgICBFeHRlbmRlZFZNLmV4dGVuZCA9IGV4dGVuZFxuICAgIEV4dGVuZGVkVk0uc3VwZXIgPSBQYXJlbnRWTVxuICAgIEV4dGVuZGVkVk0ub3B0aW9ucyA9IG9wdGlvbnNcbiAgICByZXR1cm4gRXh0ZW5kZWRWTVxufVxuXG4vKipcbiAqICBJbmhlcml0IG9wdGlvbnNcbiAqXG4gKiAgRm9yIG9wdGlvbnMgc3VjaCBhcyBgZGF0YWAsIGB2bXNgLCBgZGlyZWN0aXZlc2AsICdwYXJ0aWFscycsXG4gKiAgdGhleSBzaG91bGQgYmUgZnVydGhlciBleHRlbmRlZC4gSG93ZXZlciBleHRlbmRpbmcgc2hvdWxkIG9ubHlcbiAqICBiZSBkb25lIGF0IHRvcCBsZXZlbC5cbiAqICBcbiAqICBgcHJvdG9gIGlzIGFuIGV4Y2VwdGlvbiBiZWNhdXNlIGl0J3MgaGFuZGxlZCBkaXJlY3RseSBvbiB0aGVcbiAqICBwcm90b3R5cGUuXG4gKlxuICogIGBlbGAgaXMgYW4gZXhjZXB0aW9uIGJlY2F1c2UgaXQncyBub3QgYWxsb3dlZCBhcyBhblxuICogIGV4dGVuc2lvbiBvcHRpb24sIGJ1dCBvbmx5IGFzIGFuIGluc3RhbmNlIG9wdGlvbi5cbiAqL1xuZnVuY3Rpb24gaW5oZXJpdE9wdGlvbnMgKGNoaWxkLCBwYXJlbnQsIHRvcExldmVsKSB7XG4gICAgY2hpbGQgPSBjaGlsZCB8fCB1dGlscy5oYXNoKClcbiAgICBpZiAoIXBhcmVudCkgcmV0dXJuIGNoaWxkXG4gICAgZm9yICh2YXIga2V5IGluIHBhcmVudCkge1xuICAgICAgICBpZiAoa2V5ID09PSAnZWwnIHx8IGtleSA9PT0gJ21ldGhvZHMnKSBjb250aW51ZVxuICAgICAgICB2YXIgdmFsID0gY2hpbGRba2V5XSxcbiAgICAgICAgICAgIHBhcmVudFZhbCA9IHBhcmVudFtrZXldLFxuICAgICAgICAgICAgdHlwZSA9IHV0aWxzLnR5cGVPZih2YWwpXG4gICAgICAgIGlmICh0b3BMZXZlbCAmJiB0eXBlID09PSAnRnVuY3Rpb24nICYmIHBhcmVudFZhbCkge1xuICAgICAgICAgICAgLy8gbWVyZ2UgaG9vayBmdW5jdGlvbnMgaW50byBhbiBhcnJheVxuICAgICAgICAgICAgY2hpbGRba2V5XSA9IFt2YWxdXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJlbnRWYWwpKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRba2V5XSA9IGNoaWxkW2tleV0uY29uY2F0KHBhcmVudFZhbClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2hpbGRba2V5XS5wdXNoKHBhcmVudFZhbClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0b3BMZXZlbCAmJiB0eXBlID09PSAnT2JqZWN0Jykge1xuICAgICAgICAgICAgLy8gbWVyZ2UgdG9wbGV2ZWwgb2JqZWN0IG9wdGlvbnNcbiAgICAgICAgICAgIGluaGVyaXRPcHRpb25zKHZhbCwgcGFyZW50VmFsKVxuICAgICAgICB9IGVsc2UgaWYgKHZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbmhlcml0IGlmIGNoaWxkIGRvZXNuJ3Qgb3ZlcnJpZGVcbiAgICAgICAgICAgIGNoaWxkW2tleV0gPSBwYXJlbnRWYWxcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY2hpbGRcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBWaWV3TW9kZWwiLCIvKiBqc2hpbnQgcHJvdG86dHJ1ZSAqL1xuXG52YXIgRW1pdHRlciAgPSByZXF1aXJlKCcuL2VtaXR0ZXInKSxcbiAgICB1dGlscyAgICA9IHJlcXVpcmUoJy4vdXRpbHMnKSxcblxuICAgIC8vIGNhY2hlIG1ldGhvZHNcbiAgICB0eXBlT2YgICA9IHV0aWxzLnR5cGVPZixcbiAgICBkZWYgICAgICA9IHV0aWxzLmRlZlByb3RlY3RlZCxcbiAgICBzbGljZSAgICA9IEFycmF5LnByb3RvdHlwZS5zbGljZSxcblxuICAgIC8vIHR5cGVzXG4gICAgT0JKRUNUICAgPSAnT2JqZWN0JyxcbiAgICBBUlJBWSAgICA9ICdBcnJheScsXG5cbiAgICAvLyBBcnJheSBtdXRhdGlvbiBtZXRob2RzIHRvIHdyYXBcbiAgICBtZXRob2RzICA9IFsncHVzaCcsJ3BvcCcsJ3NoaWZ0JywndW5zaGlmdCcsJ3NwbGljZScsJ3NvcnQnLCdyZXZlcnNlJ10sXG5cbiAgICAvLyBmaXggZm9yIElFICsgX19wcm90b19fIHByb2JsZW1cbiAgICAvLyBkZWZpbmUgbWV0aG9kcyBhcyBpbmVudW1lcmFibGUgaWYgX19wcm90b19fIGlzIHByZXNlbnQsXG4gICAgLy8gb3RoZXJ3aXNlIGVudW1lcmFibGUgc28gd2UgY2FuIGxvb3AgdGhyb3VnaCBhbmQgbWFudWFsbHlcbiAgICAvLyBhdHRhY2ggdG8gYXJyYXkgaW5zdGFuY2VzXG4gICAgaGFzUHJvdG8gPSAoe30pLl9fcHJvdG9fXyxcblxuICAgIC8vIGxhenkgbG9hZFxuICAgIFZpZXdNb2RlbFxuXG4vLyBUaGUgcHJveHkgcHJvdG90eXBlIHRvIHJlcGxhY2UgdGhlIF9fcHJvdG9fXyBvZlxuLy8gYW4gb2JzZXJ2ZWQgYXJyYXlcbnZhciBBcnJheVByb3h5ID0gT2JqZWN0LmNyZWF0ZShBcnJheS5wcm90b3R5cGUpXG5cbi8vIERlZmluZSBtdXRhdGlvbiBpbnRlcmNlcHRvcnMgc28gd2UgY2FuIGVtaXQgdGhlIG11dGF0aW9uIGluZm9cbm1ldGhvZHMuZm9yRWFjaChmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgZGVmKEFycmF5UHJveHksIG1ldGhvZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gQXJyYXkucHJvdG90eXBlW21ldGhvZF0uYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgICAgICB0aGlzLl9fb2JzZXJ2ZXJfXy5lbWl0KCdtdXRhdGUnLCBudWxsLCB0aGlzLCB7XG4gICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgIGFyZ3M6IHNsaWNlLmNhbGwoYXJndW1lbnRzKSxcbiAgICAgICAgICAgIHJlc3VsdDogcmVzdWx0XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICB9LCAhaGFzUHJvdG8pXG59KVxuXG4vKipcbiAqICBDb252ZW5pZW5jZSBtZXRob2QgdG8gcmVtb3ZlIGFuIGVsZW1lbnQgaW4gYW4gQXJyYXlcbiAqICBUaGlzIHdpbGwgYmUgYXR0YWNoZWQgdG8gb2JzZXJ2ZWQgQXJyYXkgaW5zdGFuY2VzXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZUVsZW1lbnQgKGluZGV4KSB7XG4gICAgaWYgKHR5cGVvZiBpbmRleCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YXIgaSA9IHRoaXMubGVuZ3RoLFxuICAgICAgICAgICAgcmVtb3ZlZCA9IFtdXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChpbmRleCh0aGlzW2ldKSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZWQucHVzaCh0aGlzLnNwbGljZShpLCAxKVswXSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVtb3ZlZC5yZXZlcnNlKClcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodHlwZW9mIGluZGV4ICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgaW5kZXggPSB0aGlzLmluZGV4T2YoaW5kZXgpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNwbGljZShpbmRleCwgMSlbMF1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiAgQ29udmVuaWVuY2UgbWV0aG9kIHRvIHJlcGxhY2UgYW4gZWxlbWVudCBpbiBhbiBBcnJheVxuICogIFRoaXMgd2lsbCBiZSBhdHRhY2hlZCB0byBvYnNlcnZlZCBBcnJheSBpbnN0YW5jZXNcbiAqL1xuZnVuY3Rpb24gcmVwbGFjZUVsZW1lbnQgKGluZGV4LCBkYXRhKSB7XG4gICAgaWYgKHR5cGVvZiBpbmRleCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YXIgaSA9IHRoaXMubGVuZ3RoLFxuICAgICAgICAgICAgcmVwbGFjZWQgPSBbXSxcbiAgICAgICAgICAgIHJlcGxhY2VyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIHJlcGxhY2VyID0gaW5kZXgodGhpc1tpXSlcbiAgICAgICAgICAgIGlmIChyZXBsYWNlciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmVwbGFjZWQucHVzaCh0aGlzLnNwbGljZShpLCAxLCByZXBsYWNlcilbMF0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcGxhY2VkLnJldmVyc2UoKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0eXBlb2YgaW5kZXggIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBpbmRleCA9IHRoaXMuaW5kZXhPZihpbmRleClcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3BsaWNlKGluZGV4LCAxLCBkYXRhKVswXVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBBdWdtZW50IHRoZSBBcnJheVByb3h5IHdpdGggY29udmVuaWVuY2UgbWV0aG9kc1xuZGVmKEFycmF5UHJveHksICdyZW1vdmUnLCByZW1vdmVFbGVtZW50LCAhaGFzUHJvdG8pXG5kZWYoQXJyYXlQcm94eSwgJ3NldCcsIHJlcGxhY2VFbGVtZW50LCAhaGFzUHJvdG8pXG5kZWYoQXJyYXlQcm94eSwgJ3JlcGxhY2UnLCByZXBsYWNlRWxlbWVudCwgIWhhc1Byb3RvKVxuXG4vKipcbiAqICBXYXRjaCBhbiBPYmplY3QsIHJlY3Vyc2l2ZS5cbiAqL1xuZnVuY3Rpb24gd2F0Y2hPYmplY3QgKG9iaikge1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgY29udmVydChvYmosIGtleSlcbiAgICB9XG59XG5cbi8qKlxuICogIFdhdGNoIGFuIEFycmF5LCBvdmVybG9hZCBtdXRhdGlvbiBtZXRob2RzXG4gKiAgYW5kIGFkZCBhdWdtZW50YXRpb25zIGJ5IGludGVyY2VwdGluZyB0aGUgcHJvdG90eXBlIGNoYWluXG4gKi9cbmZ1bmN0aW9uIHdhdGNoQXJyYXkgKGFycikge1xuICAgIHZhciBvYnNlcnZlciA9IGFyci5fX29ic2VydmVyX19cbiAgICBpZiAoIW9ic2VydmVyKSB7XG4gICAgICAgIG9ic2VydmVyID0gbmV3IEVtaXR0ZXIoKVxuICAgICAgICBkZWYoYXJyLCAnX19vYnNlcnZlcl9fJywgb2JzZXJ2ZXIpXG4gICAgfVxuICAgIGlmIChoYXNQcm90bykge1xuICAgICAgICBhcnIuX19wcm90b19fID0gQXJyYXlQcm94eVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBBcnJheVByb3h5KSB7XG4gICAgICAgICAgICBkZWYoYXJyLCBrZXksIEFycmF5UHJveHlba2V5XSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiAgRGVmaW5lIGFjY2Vzc29ycyBmb3IgYSBwcm9wZXJ0eSBvbiBhbiBPYmplY3RcbiAqICBzbyBpdCBlbWl0cyBnZXQvc2V0IGV2ZW50cy5cbiAqICBUaGVuIHdhdGNoIHRoZSB2YWx1ZSBpdHNlbGYuXG4gKi9cbmZ1bmN0aW9uIGNvbnZlcnQgKG9iaiwga2V5KSB7XG4gICAgdmFyIGtleVByZWZpeCA9IGtleS5jaGFyQXQoMClcbiAgICBpZiAoKGtleVByZWZpeCA9PT0gJyQnIHx8IGtleVByZWZpeCA9PT0gJ18nKSAmJiBrZXkgIT09ICckaW5kZXgnKSB7XG4gICAgICAgIHJldHVyblxuICAgIH1cbiAgICAvLyBlbWl0IHNldCBvbiBiaW5kXG4gICAgLy8gdGhpcyBtZWFucyB3aGVuIGFuIG9iamVjdCBpcyBvYnNlcnZlZCBpdCB3aWxsIGVtaXRcbiAgICAvLyBhIGZpcnN0IGJhdGNoIG9mIHNldCBldmVudHMuXG4gICAgdmFyIG9ic2VydmVyID0gb2JqLl9fb2JzZXJ2ZXJfXyxcbiAgICAgICAgdmFsdWVzICAgPSBvYnNlcnZlci52YWx1ZXMsXG4gICAgICAgIHZhbCAgICAgID0gdmFsdWVzW2tleV0gPSBvYmpba2V5XVxuICAgIG9ic2VydmVyLmVtaXQoJ3NldCcsIGtleSwgdmFsKVxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAgb2JzZXJ2ZXIuZW1pdCgnc2V0Jywga2V5ICsgJy5sZW5ndGgnLCB2YWwubGVuZ3RoKVxuICAgIH1cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB2YWx1ZXNba2V5XVxuICAgICAgICAgICAgLy8gb25seSBlbWl0IGdldCBvbiB0aXAgdmFsdWVzXG4gICAgICAgICAgICBpZiAocHViLnNob3VsZEdldCAmJiB0eXBlT2YodmFsdWUpICE9PSBPQkpFQ1QpIHtcbiAgICAgICAgICAgICAgICBvYnNlcnZlci5lbWl0KCdnZXQnLCBrZXkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWVcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAobmV3VmFsKSB7XG4gICAgICAgICAgICB2YXIgb2xkVmFsID0gdmFsdWVzW2tleV1cbiAgICAgICAgICAgIHVub2JzZXJ2ZShvbGRWYWwsIGtleSwgb2JzZXJ2ZXIpXG4gICAgICAgICAgICB2YWx1ZXNba2V5XSA9IG5ld1ZhbFxuICAgICAgICAgICAgY29weVBhdGhzKG5ld1ZhbCwgb2xkVmFsKVxuICAgICAgICAgICAgLy8gYW4gaW1tZWRpYXRlIHByb3BlcnR5IHNob3VsZCBub3RpZnkgaXRzIHBhcmVudFxuICAgICAgICAgICAgLy8gdG8gZW1pdCBzZXQgZm9yIGl0c2VsZiB0b29cbiAgICAgICAgICAgIG9ic2VydmVyLmVtaXQoJ3NldCcsIGtleSwgbmV3VmFsLCB0cnVlKVxuICAgICAgICAgICAgb2JzZXJ2ZShuZXdWYWwsIGtleSwgb2JzZXJ2ZXIpXG4gICAgICAgIH1cbiAgICB9KVxuICAgIG9ic2VydmUodmFsLCBrZXksIG9ic2VydmVyKVxufVxuXG4vKipcbiAqICBDaGVjayBpZiBhIHZhbHVlIGlzIHdhdGNoYWJsZVxuICovXG5mdW5jdGlvbiBpc1dhdGNoYWJsZSAob2JqKSB7XG4gICAgVmlld01vZGVsID0gVmlld01vZGVsIHx8IHJlcXVpcmUoJy4vdmlld21vZGVsJylcbiAgICB2YXIgdHlwZSA9IHR5cGVPZihvYmopXG4gICAgcmV0dXJuICh0eXBlID09PSBPQkpFQ1QgfHwgdHlwZSA9PT0gQVJSQVkpICYmICEob2JqIGluc3RhbmNlb2YgVmlld01vZGVsKVxufVxuXG4vKipcbiAqICBXaGVuIGEgdmFsdWUgdGhhdCBpcyBhbHJlYWR5IGNvbnZlcnRlZCBpc1xuICogIG9ic2VydmVkIGFnYWluIGJ5IGFub3RoZXIgb2JzZXJ2ZXIsIHdlIGNhbiBza2lwXG4gKiAgdGhlIHdhdGNoIGNvbnZlcnNpb24gYW5kIHNpbXBseSBlbWl0IHNldCBldmVudCBmb3JcbiAqICBhbGwgb2YgaXRzIHByb3BlcnRpZXMuXG4gKi9cbmZ1bmN0aW9uIGVtaXRTZXQgKG9iaikge1xuICAgIHZhciB0eXBlID0gdHlwZU9mKG9iaiksXG4gICAgICAgIGVtaXR0ZXIgPSBvYmogJiYgb2JqLl9fb2JzZXJ2ZXJfX1xuICAgIGlmICh0eXBlID09PSBBUlJBWSkge1xuICAgICAgICBlbWl0dGVyLmVtaXQoJ3NldCcsICdsZW5ndGgnLCBvYmoubGVuZ3RoKVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gT0JKRUNUKSB7XG4gICAgICAgIHZhciBrZXksIHZhbFxuICAgICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIHZhbCA9IG9ialtrZXldXG4gICAgICAgICAgICBlbWl0dGVyLmVtaXQoJ3NldCcsIGtleSwgdmFsKVxuICAgICAgICAgICAgZW1pdFNldCh2YWwpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogIE1ha2Ugc3VyZSBhbGwgdGhlIHBhdGhzIGluIGFuIG9sZCBvYmplY3QgZXhpc3RzXG4gKiAgaW4gYSBuZXcgb2JqZWN0LlxuICogIFNvIHdoZW4gYW4gb2JqZWN0IGNoYW5nZXMsIGFsbCBtaXNzaW5nIGtleXMgd2lsbFxuICogIGVtaXQgYSBzZXQgZXZlbnQgd2l0aCB1bmRlZmluZWQgdmFsdWUuXG4gKi9cbmZ1bmN0aW9uIGNvcHlQYXRocyAobmV3T2JqLCBvbGRPYmopIHtcbiAgICBpZiAodHlwZU9mKG9sZE9iaikgIT09IE9CSkVDVCB8fCB0eXBlT2YobmV3T2JqKSAhPT0gT0JKRUNUKSB7XG4gICAgICAgIHJldHVyblxuICAgIH1cbiAgICB2YXIgcGF0aCwgdHlwZSwgb2xkVmFsLCBuZXdWYWxcbiAgICBmb3IgKHBhdGggaW4gb2xkT2JqKSB7XG4gICAgICAgIGlmICghKHBhdGggaW4gbmV3T2JqKSkge1xuICAgICAgICAgICAgb2xkVmFsID0gb2xkT2JqW3BhdGhdXG4gICAgICAgICAgICB0eXBlID0gdHlwZU9mKG9sZFZhbClcbiAgICAgICAgICAgIGlmICh0eXBlID09PSBPQkpFQ1QpIHtcbiAgICAgICAgICAgICAgICBuZXdWYWwgPSBuZXdPYmpbcGF0aF0gPSB7fVxuICAgICAgICAgICAgICAgIGNvcHlQYXRocyhuZXdWYWwsIG9sZFZhbClcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gQVJSQVkpIHtcbiAgICAgICAgICAgICAgICBuZXdPYmpbcGF0aF0gPSBbXVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXdPYmpbcGF0aF0gPSB1bmRlZmluZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiAgd2FsayBhbG9uZyBhIHBhdGggYW5kIG1ha2Ugc3VyZSBpdCBjYW4gYmUgYWNjZXNzZWRcbiAqICBhbmQgZW51bWVyYXRlZCBpbiB0aGF0IG9iamVjdFxuICovXG5mdW5jdGlvbiBlbnN1cmVQYXRoIChvYmosIGtleSkge1xuICAgIHZhciBwYXRoID0ga2V5LnNwbGl0KCcuJyksIHNlY1xuICAgIGZvciAodmFyIGkgPSAwLCBkID0gcGF0aC5sZW5ndGggLSAxOyBpIDwgZDsgaSsrKSB7XG4gICAgICAgIHNlYyA9IHBhdGhbaV1cbiAgICAgICAgaWYgKCFvYmpbc2VjXSkge1xuICAgICAgICAgICAgb2JqW3NlY10gPSB7fVxuICAgICAgICAgICAgaWYgKG9iai5fX29ic2VydmVyX18pIGNvbnZlcnQob2JqLCBzZWMpXG4gICAgICAgIH1cbiAgICAgICAgb2JqID0gb2JqW3NlY11cbiAgICB9XG4gICAgaWYgKHR5cGVPZihvYmopID09PSBPQkpFQ1QpIHtcbiAgICAgICAgc2VjID0gcGF0aFtpXVxuICAgICAgICBpZiAoIShzZWMgaW4gb2JqKSkge1xuICAgICAgICAgICAgb2JqW3NlY10gPSB1bmRlZmluZWRcbiAgICAgICAgICAgIGlmIChvYmouX19vYnNlcnZlcl9fKSBjb252ZXJ0KG9iaiwgc2VjKVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqICBPYnNlcnZlIGFuIG9iamVjdCB3aXRoIGEgZ2l2ZW4gcGF0aCxcbiAqICBhbmQgcHJveHkgZ2V0L3NldC9tdXRhdGUgZXZlbnRzIHRvIHRoZSBwcm92aWRlZCBvYnNlcnZlci5cbiAqL1xuZnVuY3Rpb24gb2JzZXJ2ZSAob2JqLCByYXdQYXRoLCBwYXJlbnRPYikge1xuXG4gICAgaWYgKCFpc1dhdGNoYWJsZShvYmopKSByZXR1cm5cblxuICAgIHZhciBwYXRoID0gcmF3UGF0aCA/IHJhd1BhdGggKyAnLicgOiAnJyxcbiAgICAgICAgYWxyZWFkeUNvbnZlcnRlZCA9ICEhb2JqLl9fb2JzZXJ2ZXJfXyxcbiAgICAgICAgY2hpbGRPYlxuXG4gICAgaWYgKCFhbHJlYWR5Q29udmVydGVkKSB7XG4gICAgICAgIGRlZihvYmosICdfX29ic2VydmVyX18nLCBuZXcgRW1pdHRlcigpKVxuICAgIH1cblxuICAgIGNoaWxkT2IgPSBvYmouX19vYnNlcnZlcl9fXG4gICAgY2hpbGRPYi52YWx1ZXMgPSBjaGlsZE9iLnZhbHVlcyB8fCB1dGlscy5oYXNoKClcblxuICAgIC8vIHNldHVwIHByb3h5IGxpc3RlbmVycyBvbiB0aGUgcGFyZW50IG9ic2VydmVyLlxuICAgIC8vIHdlIG5lZWQgdG8ga2VlcCByZWZlcmVuY2UgdG8gdGhlbSBzbyB0aGF0IHRoZXlcbiAgICAvLyBjYW4gYmUgcmVtb3ZlZCB3aGVuIHRoZSBvYmplY3QgaXMgdW4tb2JzZXJ2ZWQuXG4gICAgcGFyZW50T2IucHJveGllcyA9IHBhcmVudE9iLnByb3hpZXMgfHwge31cbiAgICB2YXIgcHJveGllcyA9IHBhcmVudE9iLnByb3hpZXNbcGF0aF0gPSB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcGFyZW50T2IuZW1pdCgnZ2V0JywgcGF0aCArIGtleSlcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoa2V5LCB2YWwsIHByb3BhZ2F0ZSkge1xuICAgICAgICAgICAgcGFyZW50T2IuZW1pdCgnc2V0JywgcGF0aCArIGtleSwgdmFsKVxuICAgICAgICAgICAgLy8gYWxzbyBub3RpZnkgb2JzZXJ2ZXIgdGhhdCB0aGUgb2JqZWN0IGl0c2VsZiBjaGFuZ2VkXG4gICAgICAgICAgICAvLyBidXQgb25seSBkbyBzbyB3aGVuIGl0J3MgYSBpbW1lZGlhdGUgcHJvcGVydHkuIHRoaXNcbiAgICAgICAgICAgIC8vIGF2b2lkcyBkdXBsaWNhdGUgZXZlbnQgZmlyaW5nLlxuICAgICAgICAgICAgaWYgKHJhd1BhdGggJiYgcHJvcGFnYXRlKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50T2IuZW1pdCgnc2V0JywgcmF3UGF0aCwgb2JqLCB0cnVlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBtdXRhdGU6IGZ1bmN0aW9uIChrZXksIHZhbCwgbXV0YXRpb24pIHtcbiAgICAgICAgICAgIC8vIGlmIHRoZSBBcnJheSBpcyBhIHJvb3QgdmFsdWVcbiAgICAgICAgICAgIC8vIHRoZSBrZXkgd2lsbCBiZSBudWxsXG4gICAgICAgICAgICB2YXIgZml4ZWRQYXRoID0ga2V5ID8gcGF0aCArIGtleSA6IHJhd1BhdGhcbiAgICAgICAgICAgIHBhcmVudE9iLmVtaXQoJ211dGF0ZScsIGZpeGVkUGF0aCwgdmFsLCBtdXRhdGlvbilcbiAgICAgICAgICAgIC8vIGFsc28gZW1pdCBzZXQgZm9yIEFycmF5J3MgbGVuZ3RoIHdoZW4gaXQgbXV0YXRlc1xuICAgICAgICAgICAgdmFyIG0gPSBtdXRhdGlvbi5tZXRob2RcbiAgICAgICAgICAgIGlmIChtICE9PSAnc29ydCcgJiYgbSAhPT0gJ3JldmVyc2UnKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50T2IuZW1pdCgnc2V0JywgZml4ZWRQYXRoICsgJy5sZW5ndGgnLCB2YWwubGVuZ3RoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYXR0YWNoIHRoZSBsaXN0ZW5lcnMgdG8gdGhlIGNoaWxkIG9ic2VydmVyLlxuICAgIC8vIG5vdyBhbGwgdGhlIGV2ZW50cyB3aWxsIHByb3BhZ2F0ZSB1cHdhcmRzLlxuICAgIGNoaWxkT2JcbiAgICAgICAgLm9uKCdnZXQnLCBwcm94aWVzLmdldClcbiAgICAgICAgLm9uKCdzZXQnLCBwcm94aWVzLnNldClcbiAgICAgICAgLm9uKCdtdXRhdGUnLCBwcm94aWVzLm11dGF0ZSlcblxuICAgIGlmIChhbHJlYWR5Q29udmVydGVkKSB7XG4gICAgICAgIC8vIGZvciBvYmplY3RzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gY29udmVydGVkLFxuICAgICAgICAvLyBlbWl0IHNldCBldmVudHMgZm9yIGV2ZXJ5dGhpbmcgaW5zaWRlXG4gICAgICAgIGVtaXRTZXQob2JqKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciB0eXBlID0gdHlwZU9mKG9iailcbiAgICAgICAgaWYgKHR5cGUgPT09IE9CSkVDVCkge1xuICAgICAgICAgICAgd2F0Y2hPYmplY3Qob2JqKVxuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IEFSUkFZKSB7XG4gICAgICAgICAgICB3YXRjaEFycmF5KG9iailcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiAgQ2FuY2VsIG9ic2VydmF0aW9uLCB0dXJuIG9mZiB0aGUgbGlzdGVuZXJzLlxuICovXG5mdW5jdGlvbiB1bm9ic2VydmUgKG9iaiwgcGF0aCwgb2JzZXJ2ZXIpIHtcblxuICAgIGlmICghb2JqIHx8ICFvYmouX19vYnNlcnZlcl9fKSByZXR1cm5cblxuICAgIHBhdGggPSBwYXRoID8gcGF0aCArICcuJyA6ICcnXG4gICAgdmFyIHByb3hpZXMgPSBvYnNlcnZlci5wcm94aWVzW3BhdGhdXG4gICAgaWYgKCFwcm94aWVzKSByZXR1cm5cblxuICAgIC8vIHR1cm4gb2ZmIGxpc3RlbmVyc1xuICAgIG9iai5fX29ic2VydmVyX19cbiAgICAgICAgLm9mZignZ2V0JywgcHJveGllcy5nZXQpXG4gICAgICAgIC5vZmYoJ3NldCcsIHByb3hpZXMuc2V0KVxuICAgICAgICAub2ZmKCdtdXRhdGUnLCBwcm94aWVzLm11dGF0ZSlcblxuICAgIC8vIHJlbW92ZSByZWZlcmVuY2VcbiAgICBvYnNlcnZlci5wcm94aWVzW3BhdGhdID0gbnVsbFxufVxuXG52YXIgcHViID0gbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvLyB3aGV0aGVyIHRvIGVtaXQgZ2V0IGV2ZW50c1xuICAgIC8vIG9ubHkgZW5hYmxlZCBkdXJpbmcgZGVwZW5kZW5jeSBwYXJzaW5nXG4gICAgc2hvdWxkR2V0ICAgOiBmYWxzZSxcblxuICAgIG9ic2VydmUgICAgIDogb2JzZXJ2ZSxcbiAgICB1bm9ic2VydmUgICA6IHVub2JzZXJ2ZSxcbiAgICBlbnN1cmVQYXRoICA6IGVuc3VyZVBhdGgsXG4gICAgY29udmVydCAgICAgOiBjb252ZXJ0LFxuICAgIGNvcHlQYXRocyAgIDogY29weVBhdGhzLFxuICAgIHdhdGNoQXJyYXkgIDogd2F0Y2hBcnJheVxufSIsInZhciBCSU5ESU5HX1JFID0gL3t7ez8oW157fV0rPyl9P319LyxcbiAgICBUUklQTEVfUkUgPSAve3t7W157fV0rfX19L1xuXG4vKipcbiAqICBQYXJzZSBhIHBpZWNlIG9mIHRleHQsIHJldHVybiBhbiBhcnJheSBvZiB0b2tlbnNcbiAqL1xuZnVuY3Rpb24gcGFyc2UgKHRleHQpIHtcbiAgICBpZiAoIUJJTkRJTkdfUkUudGVzdCh0ZXh0KSkgcmV0dXJuIG51bGxcbiAgICB2YXIgbSwgaSwgdG9rZW4sIHRva2VucyA9IFtdXG4gICAgLyoganNoaW50IGJvc3M6IHRydWUgKi9cbiAgICB3aGlsZSAobSA9IHRleHQubWF0Y2goQklORElOR19SRSkpIHtcbiAgICAgICAgaSA9IG0uaW5kZXhcbiAgICAgICAgaWYgKGkgPiAwKSB0b2tlbnMucHVzaCh0ZXh0LnNsaWNlKDAsIGkpKVxuICAgICAgICB0b2tlbiA9IHsga2V5OiBtWzFdLnRyaW0oKSB9XG4gICAgICAgIGlmIChUUklQTEVfUkUudGVzdChtWzBdKSkgdG9rZW4uaHRtbCA9IHRydWVcbiAgICAgICAgdG9rZW5zLnB1c2godG9rZW4pXG4gICAgICAgIHRleHQgPSB0ZXh0LnNsaWNlKGkgKyBtWzBdLmxlbmd0aClcbiAgICB9XG4gICAgaWYgKHRleHQubGVuZ3RoKSB0b2tlbnMucHVzaCh0ZXh0KVxuICAgIHJldHVybiB0b2tlbnNcbn1cblxuLyoqXG4gKiAgUGFyc2UgYW4gYXR0cmlidXRlIHZhbHVlIHdpdGggcG9zc2libGUgaW50ZXJwb2xhdGlvbiB0YWdzXG4gKiAgcmV0dXJuIGEgRGlyZWN0aXZlLWZyaWVuZGx5IGV4cHJlc3Npb25cbiAqL1xuZnVuY3Rpb24gcGFyc2VBdHRyIChhdHRyKSB7XG4gICAgdmFyIHRva2VucyA9IHBhcnNlKGF0dHIpXG4gICAgaWYgKCF0b2tlbnMpIHJldHVybiBudWxsXG4gICAgdmFyIHJlcyA9IFtdLCB0b2tlblxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdG9rZW5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB0b2tlbiA9IHRva2Vuc1tpXVxuICAgICAgICByZXMucHVzaCh0b2tlbi5rZXkgfHwgKCdcIicgKyB0b2tlbiArICdcIicpKVxuICAgIH1cbiAgICByZXR1cm4gcmVzLmpvaW4oJysnKVxufVxuXG5leHBvcnRzLnBhcnNlID0gcGFyc2VcbmV4cG9ydHMucGFyc2VBdHRyID0gcGFyc2VBdHRyIiwidmFyIGVuZEV2ZW50ICAgPSBzbmlmZlRyYW5zaXRpb25FbmRFdmVudCgpLFxuICAgIGNvbmZpZyAgICAgPSByZXF1aXJlKCcuL2NvbmZpZycpLFxuICAgIC8vIGV4aXQgY29kZXMgZm9yIHRlc3RpbmdcbiAgICBjb2RlcyA9IHtcbiAgICAgICAgQ1NTX0UgICAgIDogMSxcbiAgICAgICAgQ1NTX0wgICAgIDogMixcbiAgICAgICAgSlNfRSAgICAgIDogMyxcbiAgICAgICAgSlNfTCAgICAgIDogNCxcbiAgICAgICAgQ1NTX1NLSVAgIDogLTEsXG4gICAgICAgIEpTX1NLSVAgICA6IC0yLFxuICAgICAgICBKU19TS0lQX0UgOiAtMyxcbiAgICAgICAgSlNfU0tJUF9MIDogLTQsXG4gICAgICAgIElOSVQgICAgICA6IC01LFxuICAgICAgICBTS0lQICAgICAgOiAtNlxuICAgIH1cblxuLyoqXG4gKiAgc3RhZ2U6XG4gKiAgICAxID0gZW50ZXJcbiAqICAgIDIgPSBsZWF2ZVxuICovXG52YXIgdHJhbnNpdGlvbiA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGVsLCBzdGFnZSwgY2IsIGNvbXBpbGVyKSB7XG5cbiAgICB2YXIgY2hhbmdlU3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNiKClcbiAgICAgICAgY29tcGlsZXIuZXhlY0hvb2soc3RhZ2UgPiAwID8gJ2F0dGFjaGVkJyA6ICdkZXRhY2hlZCcpXG4gICAgfVxuXG4gICAgaWYgKGNvbXBpbGVyLmluaXQpIHtcbiAgICAgICAgY2hhbmdlU3RhdGUoKVxuICAgICAgICByZXR1cm4gY29kZXMuSU5JVFxuICAgIH1cblxuICAgIHZhciB0cmFuc2l0aW9uSWQgPSBlbC52dWVfdHJhbnNcblxuICAgIGlmICh0cmFuc2l0aW9uSWQpIHtcbiAgICAgICAgcmV0dXJuIGFwcGx5VHJhbnNpdGlvbkZ1bmN0aW9ucyhcbiAgICAgICAgICAgIGVsLFxuICAgICAgICAgICAgc3RhZ2UsXG4gICAgICAgICAgICBjaGFuZ2VTdGF0ZSxcbiAgICAgICAgICAgIHRyYW5zaXRpb25JZCxcbiAgICAgICAgICAgIGNvbXBpbGVyXG4gICAgICAgIClcbiAgICB9IGVsc2UgaWYgKHRyYW5zaXRpb25JZCA9PT0gJycpIHtcbiAgICAgICAgcmV0dXJuIGFwcGx5VHJhbnNpdGlvbkNsYXNzKFxuICAgICAgICAgICAgZWwsXG4gICAgICAgICAgICBzdGFnZSxcbiAgICAgICAgICAgIGNoYW5nZVN0YXRlXG4gICAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgICBjaGFuZ2VTdGF0ZSgpXG4gICAgICAgIHJldHVybiBjb2Rlcy5TS0lQXG4gICAgfVxuXG59XG5cbnRyYW5zaXRpb24uY29kZXMgPSBjb2Rlc1xuXG4vKipcbiAqICBUb2dnZ2xlIGEgQ1NTIGNsYXNzIHRvIHRyaWdnZXIgdHJhbnNpdGlvblxuICovXG5mdW5jdGlvbiBhcHBseVRyYW5zaXRpb25DbGFzcyAoZWwsIHN0YWdlLCBjaGFuZ2VTdGF0ZSkge1xuXG4gICAgaWYgKCFlbmRFdmVudCkge1xuICAgICAgICBjaGFuZ2VTdGF0ZSgpXG4gICAgICAgIHJldHVybiBjb2Rlcy5DU1NfU0tJUFxuICAgIH1cblxuICAgIC8vIGlmIHRoZSBicm93c2VyIHN1cHBvcnRzIHRyYW5zaXRpb24sXG4gICAgLy8gaXQgbXVzdCBoYXZlIGNsYXNzTGlzdC4uLlxuICAgIHZhciBjbGFzc0xpc3QgICAgICAgICA9IGVsLmNsYXNzTGlzdCxcbiAgICAgICAgbGFzdExlYXZlQ2FsbGJhY2sgPSBlbC52dWVfdHJhbnNfY2JcblxuICAgIGlmIChzdGFnZSA+IDApIHsgLy8gZW50ZXJcblxuICAgICAgICAvLyBjYW5jZWwgdW5maW5pc2hlZCBsZWF2ZSB0cmFuc2l0aW9uXG4gICAgICAgIGlmIChsYXN0TGVhdmVDYWxsYmFjaykge1xuICAgICAgICAgICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihlbmRFdmVudCwgbGFzdExlYXZlQ2FsbGJhY2spXG4gICAgICAgICAgICBlbC52dWVfdHJhbnNfY2IgPSBudWxsXG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdG8gaGlkZGVuIHN0YXRlIGJlZm9yZSBhcHBlbmRpbmdcbiAgICAgICAgY2xhc3NMaXN0LmFkZChjb25maWcuZW50ZXJDbGFzcylcbiAgICAgICAgLy8gYXBwZW5kXG4gICAgICAgIGNoYW5nZVN0YXRlKClcbiAgICAgICAgLy8gZm9yY2UgYSBsYXlvdXQgc28gdHJhbnNpdGlvbiBjYW4gYmUgdHJpZ2dlcmVkXG4gICAgICAgIC8qIGpzaGludCB1bnVzZWQ6IGZhbHNlICovXG4gICAgICAgIHZhciBmb3JjZUxheW91dCA9IGVsLmNsaWVudEhlaWdodFxuICAgICAgICAvLyB0cmlnZ2VyIHRyYW5zaXRpb25cbiAgICAgICAgY2xhc3NMaXN0LnJlbW92ZShjb25maWcuZW50ZXJDbGFzcylcbiAgICAgICAgcmV0dXJuIGNvZGVzLkNTU19FXG5cbiAgICB9IGVsc2UgeyAvLyBsZWF2ZVxuXG4gICAgICAgIC8vIHRyaWdnZXIgaGlkZSB0cmFuc2l0aW9uXG4gICAgICAgIGNsYXNzTGlzdC5hZGQoY29uZmlnLmxlYXZlQ2xhc3MpXG4gICAgICAgIHZhciBvbkVuZCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IGVsKSB7XG4gICAgICAgICAgICAgICAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihlbmRFdmVudCwgb25FbmQpXG4gICAgICAgICAgICAgICAgZWwudnVlX3RyYW5zX2NiID0gbnVsbFxuICAgICAgICAgICAgICAgIC8vIGFjdHVhbGx5IHJlbW92ZSBub2RlIGhlcmVcbiAgICAgICAgICAgICAgICBjaGFuZ2VTdGF0ZSgpXG4gICAgICAgICAgICAgICAgY2xhc3NMaXN0LnJlbW92ZShjb25maWcubGVhdmVDbGFzcylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBhdHRhY2ggdHJhbnNpdGlvbiBlbmQgbGlzdGVuZXJcbiAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcihlbmRFdmVudCwgb25FbmQpXG4gICAgICAgIGVsLnZ1ZV90cmFuc19jYiA9IG9uRW5kXG4gICAgICAgIHJldHVybiBjb2Rlcy5DU1NfTFxuICAgICAgICBcbiAgICB9XG5cbn1cblxuZnVuY3Rpb24gYXBwbHlUcmFuc2l0aW9uRnVuY3Rpb25zIChlbCwgc3RhZ2UsIGNoYW5nZVN0YXRlLCBmdW5jdGlvbklkLCBjb21waWxlcikge1xuXG4gICAgdmFyIGZ1bmNzID0gY29tcGlsZXIuZ2V0T3B0aW9uKCd0cmFuc2l0aW9ucycsIGZ1bmN0aW9uSWQpXG4gICAgaWYgKCFmdW5jcykge1xuICAgICAgICBjaGFuZ2VTdGF0ZSgpXG4gICAgICAgIHJldHVybiBjb2Rlcy5KU19TS0lQXG4gICAgfVxuXG4gICAgdmFyIGVudGVyID0gZnVuY3MuZW50ZXIsXG4gICAgICAgIGxlYXZlID0gZnVuY3MubGVhdmVcblxuICAgIGlmIChzdGFnZSA+IDApIHsgLy8gZW50ZXJcbiAgICAgICAgaWYgKHR5cGVvZiBlbnRlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2hhbmdlU3RhdGUoKVxuICAgICAgICAgICAgcmV0dXJuIGNvZGVzLkpTX1NLSVBfRVxuICAgICAgICB9XG4gICAgICAgIGVudGVyKGVsLCBjaGFuZ2VTdGF0ZSlcbiAgICAgICAgcmV0dXJuIGNvZGVzLkpTX0VcbiAgICB9IGVsc2UgeyAvLyBsZWF2ZVxuICAgICAgICBpZiAodHlwZW9mIGxlYXZlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjaGFuZ2VTdGF0ZSgpXG4gICAgICAgICAgICByZXR1cm4gY29kZXMuSlNfU0tJUF9MXG4gICAgICAgIH1cbiAgICAgICAgbGVhdmUoZWwsIGNoYW5nZVN0YXRlKVxuICAgICAgICByZXR1cm4gY29kZXMuSlNfTFxuICAgIH1cblxufVxuXG4vKipcbiAqICBTbmlmZiBwcm9wZXIgdHJhbnNpdGlvbiBlbmQgZXZlbnQgbmFtZVxuICovXG5mdW5jdGlvbiBzbmlmZlRyYW5zaXRpb25FbmRFdmVudCAoKSB7XG4gICAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndnVlJyksXG4gICAgICAgIGRlZmF1bHRFdmVudCA9ICd0cmFuc2l0aW9uZW5kJyxcbiAgICAgICAgZXZlbnRzID0ge1xuICAgICAgICAgICAgJ3RyYW5zaXRpb24nICAgICAgIDogZGVmYXVsdEV2ZW50LFxuICAgICAgICAgICAgJ21velRyYW5zaXRpb24nICAgIDogZGVmYXVsdEV2ZW50LFxuICAgICAgICAgICAgJ3dlYmtpdFRyYW5zaXRpb24nIDogJ3dlYmtpdFRyYW5zaXRpb25FbmQnXG4gICAgICAgIH1cbiAgICBmb3IgKHZhciBuYW1lIGluIGV2ZW50cykge1xuICAgICAgICBpZiAoZWwuc3R5bGVbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIGV2ZW50c1tuYW1lXVxuICAgICAgICB9XG4gICAgfVxufSIsInZhciBjb25maWcgICAgPSByZXF1aXJlKCcuL2NvbmZpZycpLFxuICAgIGF0dHJzICAgICA9IGNvbmZpZy5hdHRycyxcbiAgICB0b1N0cmluZyAgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuICAgIGpvaW4gICAgICA9IEFycmF5LnByb3RvdHlwZS5qb2luLFxuICAgIGNvbnNvbGUgICA9IHdpbmRvdy5jb25zb2xlLFxuXG4gICAgaGFzQ2xhc3NMaXN0ID0gJ2NsYXNzTGlzdCcgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LFxuICAgIFZpZXdNb2RlbCAvLyBsYXRlIGRlZlxuXG52YXIgZGVmZXIgPVxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICB3aW5kb3cud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgd2luZG93LnNldFRpbWVvdXRcblxuLyoqXG4gKiAgQ3JlYXRlIGEgcHJvdG90eXBlLWxlc3Mgb2JqZWN0XG4gKiAgd2hpY2ggaXMgYSBiZXR0ZXIgaGFzaC9tYXBcbiAqL1xuZnVuY3Rpb24gbWFrZUhhc2ggKCkge1xuICAgIHJldHVybiBPYmplY3QuY3JlYXRlKG51bGwpXG59XG5cbnZhciB1dGlscyA9IG1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgaGFzaDogbWFrZUhhc2gsXG5cbiAgICAvLyBnbG9iYWwgc3RvcmFnZSBmb3IgdXNlci1yZWdpc3RlcmVkXG4gICAgLy8gdm1zLCBwYXJ0aWFscyBhbmQgdHJhbnNpdGlvbnNcbiAgICBjb21wb25lbnRzICA6IG1ha2VIYXNoKCksXG4gICAgcGFydGlhbHMgICAgOiBtYWtlSGFzaCgpLFxuICAgIHRyYW5zaXRpb25zIDogbWFrZUhhc2goKSxcblxuICAgIC8qKlxuICAgICAqICBnZXQgYW4gYXR0cmlidXRlIGFuZCByZW1vdmUgaXQuXG4gICAgICovXG4gICAgYXR0cjogZnVuY3Rpb24gKGVsLCB0eXBlLCBub1JlbW92ZSkge1xuICAgICAgICB2YXIgYXR0ciA9IGF0dHJzW3R5cGVdLFxuICAgICAgICAgICAgdmFsID0gZWwuZ2V0QXR0cmlidXRlKGF0dHIpXG4gICAgICAgIGlmICghbm9SZW1vdmUgJiYgdmFsICE9PSBudWxsKSBlbC5yZW1vdmVBdHRyaWJ1dGUoYXR0cilcbiAgICAgICAgcmV0dXJuIHZhbFxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgRGVmaW5lIGFuIGllbnVtZXJhYmxlIHByb3BlcnR5XG4gICAgICogIFRoaXMgYXZvaWRzIGl0IGJlaW5nIGluY2x1ZGVkIGluIEpTT04uc3RyaW5naWZ5XG4gICAgICogIG9yIGZvci4uLmluIGxvb3BzLlxuICAgICAqL1xuICAgIGRlZlByb3RlY3RlZDogZnVuY3Rpb24gKG9iaiwga2V5LCB2YWwsIGVudW1lcmFibGUsIGNvbmZpZ3VyYWJsZSkge1xuICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGtleSkpIHJldHVyblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHtcbiAgICAgICAgICAgIHZhbHVlICAgICAgICA6IHZhbCxcbiAgICAgICAgICAgIGVudW1lcmFibGUgICA6ICEhZW51bWVyYWJsZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6ICEhY29uZmlndXJhYmxlXG4gICAgICAgIH0pXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqICBBY2N1cmF0ZSB0eXBlIGNoZWNrXG4gICAgICogIGludGVybmFsIHVzZSBvbmx5LCBzbyBubyBuZWVkIHRvIGNoZWNrIGZvciBOYU5cbiAgICAgKi9cbiAgICB0eXBlT2Y6IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKS5zbGljZSg4LCAtMSlcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogIE1vc3Qgc2ltcGxlIGJpbmRcbiAgICAgKiAgZW5vdWdoIGZvciB0aGUgdXNlY2FzZSBhbmQgZmFzdCB0aGFuIG5hdGl2ZSBiaW5kKClcbiAgICAgKi9cbiAgICBiaW5kOiBmdW5jdGlvbiAoZm4sIGN0eCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgcmV0dXJuIGZuLmNhbGwoY3R4LCBhcmcpXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogIE1ha2Ugc3VyZSBvbmx5IHN0cmluZ3MsIGJvb2xlYW5zLCBudW1iZXJzIGFuZFxuICAgICAqICBvYmplY3RzIGFyZSBvdXRwdXQgdG8gaHRtbC4gb3RoZXJ3aXNlLCBvdXB1dCBlbXB0eSBzdHJpbmcuXG4gICAgICovXG4gICAgdG9UZXh0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgLyoganNoaW50IGVxZXFlcTogZmFsc2UgKi9cbiAgICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWVcbiAgICAgICAgcmV0dXJuICh0eXBlID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgdHlwZSA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICAgICAodHlwZSA9PT0gJ251bWJlcicgJiYgdmFsdWUgPT0gdmFsdWUpKSAvLyBkZWFsIHdpdGggTmFOXG4gICAgICAgICAgICAgICAgPyB2YWx1ZVxuICAgICAgICAgICAgICAgIDogdHlwZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGxcbiAgICAgICAgICAgICAgICAgICAgPyBKU09OLnN0cmluZ2lmeSh2YWx1ZSlcbiAgICAgICAgICAgICAgICAgICAgOiAnJ1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgc2ltcGxlIGV4dGVuZFxuICAgICAqL1xuICAgIGV4dGVuZDogZnVuY3Rpb24gKG9iaiwgZXh0LCBwcm90ZWN0aXZlKSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBleHQpIHtcbiAgICAgICAgICAgIGlmIChwcm90ZWN0aXZlICYmIG9ialtrZXldKSBjb250aW51ZVxuICAgICAgICAgICAgb2JqW2tleV0gPSBleHRba2V5XVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqICBmaWx0ZXIgYW4gYXJyYXkgd2l0aCBkdXBsaWNhdGVzIGludG8gdW5pcXVlc1xuICAgICAqL1xuICAgIHVuaXF1ZTogZnVuY3Rpb24gKGFycikge1xuICAgICAgICB2YXIgaGFzaCA9IHV0aWxzLmhhc2goKSxcbiAgICAgICAgICAgIGkgPSBhcnIubGVuZ3RoLFxuICAgICAgICAgICAga2V5LCByZXMgPSBbXVxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBrZXkgPSBhcnJbaV1cbiAgICAgICAgICAgIGlmIChoYXNoW2tleV0pIGNvbnRpbnVlXG4gICAgICAgICAgICBoYXNoW2tleV0gPSAxXG4gICAgICAgICAgICByZXMucHVzaChrZXkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgQ29udmVydCBhIHN0cmluZyB0ZW1wbGF0ZSB0byBhIGRvbSBmcmFnbWVudFxuICAgICAqL1xuICAgIHRvRnJhZ21lbnQ6IGZ1bmN0aW9uICh0ZW1wbGF0ZSkge1xuICAgICAgICBpZiAodHlwZW9mIHRlbXBsYXRlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcmV0dXJuIHRlbXBsYXRlXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRlbXBsYXRlLmNoYXJBdCgwKSA9PT0gJyMnKSB7XG4gICAgICAgICAgICB2YXIgdGVtcGxhdGVOb2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGVtcGxhdGUuc2xpY2UoMSkpXG4gICAgICAgICAgICBpZiAoIXRlbXBsYXRlTm9kZSkgcmV0dXJuXG4gICAgICAgICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlTm9kZS5pbm5lckhUTUxcbiAgICAgICAgfVxuICAgICAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuICAgICAgICAgICAgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSxcbiAgICAgICAgICAgIGNoaWxkXG4gICAgICAgIG5vZGUuaW5uZXJIVE1MID0gdGVtcGxhdGUudHJpbSgpXG4gICAgICAgIC8qIGpzaGludCBib3NzOiB0cnVlICovXG4gICAgICAgIHdoaWxlIChjaGlsZCA9IG5vZGUuZmlyc3RDaGlsZCkge1xuICAgICAgICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmFwcGVuZENoaWxkKGNoaWxkKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmcmFnXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqICBDb252ZXJ0IHRoZSBvYmplY3QgdG8gYSBWaWV3TW9kZWwgY29uc3RydWN0b3JcbiAgICAgKiAgaWYgaXQgaXMgbm90IGFscmVhZHkgb25lXG4gICAgICovXG4gICAgdG9Db25zdHJ1Y3RvcjogZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBWaWV3TW9kZWwgPSBWaWV3TW9kZWwgfHwgcmVxdWlyZSgnLi92aWV3bW9kZWwnKVxuICAgICAgICByZXR1cm4gdXRpbHMudHlwZU9mKG9iaikgPT09ICdPYmplY3QnXG4gICAgICAgICAgICA/IFZpZXdNb2RlbC5leHRlbmQob2JqKVxuICAgICAgICAgICAgOiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nXG4gICAgICAgICAgICAgICAgPyBvYmpcbiAgICAgICAgICAgICAgICA6IG51bGxcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogIGNvbnZlcnQgY2VydGFpbiBvcHRpb24gdmFsdWVzIHRvIHRoZSBkZXNpcmVkIGZvcm1hdC5cbiAgICAgKi9cbiAgICBwcm9jZXNzT3B0aW9uczogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGNvbXBvbmVudHMgPSBvcHRpb25zLmNvbXBvbmVudHMsXG4gICAgICAgICAgICBwYXJ0aWFscyAgID0gb3B0aW9ucy5wYXJ0aWFscyxcbiAgICAgICAgICAgIHRlbXBsYXRlICAgPSBvcHRpb25zLnRlbXBsYXRlLFxuICAgICAgICAgICAga2V5XG4gICAgICAgIGlmIChjb21wb25lbnRzKSB7XG4gICAgICAgICAgICBmb3IgKGtleSBpbiBjb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50c1trZXldID0gdXRpbHMudG9Db25zdHJ1Y3Rvcihjb21wb25lbnRzW2tleV0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcnRpYWxzKSB7XG4gICAgICAgICAgICBmb3IgKGtleSBpbiBwYXJ0aWFscykge1xuICAgICAgICAgICAgICAgIHBhcnRpYWxzW2tleV0gPSB1dGlscy50b0ZyYWdtZW50KHBhcnRpYWxzW2tleV0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRlbXBsYXRlKSB7XG4gICAgICAgICAgICBvcHRpb25zLnRlbXBsYXRlID0gdXRpbHMudG9GcmFnbWVudCh0ZW1wbGF0ZSlcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgbG9nIGZvciBkZWJ1Z2dpbmdcbiAgICAgKi9cbiAgICBsb2c6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKGNvbmZpZy5kZWJ1ZyAmJiBjb25zb2xlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhqb2luLmNhbGwoYXJndW1lbnRzLCAnICcpKVxuICAgICAgICB9XG4gICAgfSxcbiAgICBcbiAgICAvKipcbiAgICAgKiAgd2FybmluZ3MsIHRyYWNlcyBieSBkZWZhdWx0XG4gICAgICogIGNhbiBiZSBzdXBwcmVzc2VkIGJ5IGBzaWxlbnRgIG9wdGlvbi5cbiAgICAgKi9cbiAgICB3YXJuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCFjb25maWcuc2lsZW50ICYmIGNvbnNvbGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybihqb2luLmNhbGwoYXJndW1lbnRzLCAnICcpKVxuICAgICAgICAgICAgaWYgKGNvbmZpZy5kZWJ1Zykge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUudHJhY2UoKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqICB1c2VkIHRvIGRlZmVyIGJhdGNoIHVwZGF0ZXNcbiAgICAgKi9cbiAgICBuZXh0VGljazogZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIGRlZmVyKGNiLCAwKVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiAgYWRkIGNsYXNzIGZvciBJRTlcbiAgICAgKiAgdXNlcyBjbGFzc0xpc3QgaWYgYXZhaWxhYmxlXG4gICAgICovXG4gICAgYWRkQ2xhc3M6IGZ1bmN0aW9uIChlbCwgY2xzKSB7XG4gICAgICAgIGlmIChoYXNDbGFzc0xpc3QpIHtcbiAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xzKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGN1ciA9ICcgJyArIGVsLmNsYXNzTmFtZSArICcgJ1xuICAgICAgICAgICAgaWYgKGN1ci5pbmRleE9mKCcgJyArIGNscyArICcgJykgPCAwKSB7XG4gICAgICAgICAgICAgICAgZWwuY2xhc3NOYW1lID0gKGN1ciArIGNscykudHJpbSgpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogIHJlbW92ZSBjbGFzcyBmb3IgSUU5XG4gICAgICovXG4gICAgcmVtb3ZlQ2xhc3M6IGZ1bmN0aW9uIChlbCwgY2xzKSB7XG4gICAgICAgIGlmIChoYXNDbGFzc0xpc3QpIHtcbiAgICAgICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoY2xzKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGN1ciA9ICcgJyArIGVsLmNsYXNzTmFtZSArICcgJyxcbiAgICAgICAgICAgICAgICB0YXIgPSAnICcgKyBjbHMgKyAnICdcbiAgICAgICAgICAgIHdoaWxlIChjdXIuaW5kZXhPZih0YXIpID49IDApIHtcbiAgICAgICAgICAgICAgICBjdXIgPSBjdXIucmVwbGFjZSh0YXIsICcgJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsLmNsYXNzTmFtZSA9IGN1ci50cmltKClcbiAgICAgICAgfVxuICAgIH1cbn0iLCJ2YXIgQ29tcGlsZXIgICA9IHJlcXVpcmUoJy4vY29tcGlsZXInKSxcbiAgICB1dGlscyAgICAgID0gcmVxdWlyZSgnLi91dGlscycpLFxuICAgIHRyYW5zaXRpb24gPSByZXF1aXJlKCcuL3RyYW5zaXRpb24nKSxcbiAgICBkZWYgICAgICAgID0gdXRpbHMuZGVmUHJvdGVjdGVkLFxuICAgIG5leHRUaWNrICAgPSB1dGlscy5uZXh0VGlja1xuXG4vKipcbiAqICBWaWV3TW9kZWwgZXhwb3NlZCB0byB0aGUgdXNlciB0aGF0IGhvbGRzIGRhdGEsXG4gKiAgY29tcHV0ZWQgcHJvcGVydGllcywgZXZlbnQgaGFuZGxlcnNcbiAqICBhbmQgYSBmZXcgcmVzZXJ2ZWQgbWV0aG9kc1xuICovXG5mdW5jdGlvbiBWaWV3TW9kZWwgKG9wdGlvbnMpIHtcbiAgICAvLyBqdXN0IGNvbXBpbGUuIG9wdGlvbnMgYXJlIHBhc3NlZCBkaXJlY3RseSB0byBjb21waWxlclxuICAgIG5ldyBDb21waWxlcih0aGlzLCBvcHRpb25zKVxufVxuXG4vLyBBbGwgVk0gcHJvdG90eXBlIG1ldGhvZHMgYXJlIGluZW51bWVyYWJsZVxuLy8gc28gaXQgY2FuIGJlIHN0cmluZ2lmaWVkL2xvb3BlZCB0aHJvdWdoIGFzIHJhdyBkYXRhXG52YXIgVk1Qcm90byA9IFZpZXdNb2RlbC5wcm90b3R5cGVcblxuLyoqXG4gKiAgQ29udmVuaWVuY2UgZnVuY3Rpb24gdG8gc2V0IGFuIGFjdHVhbCBuZXN0ZWQgdmFsdWVcbiAqICBmcm9tIGEgZmxhdCBrZXkgc3RyaW5nLiBVc2VkIGluIGRpcmVjdGl2ZXMuXG4gKi9cbmRlZihWTVByb3RvLCAnJHNldCcsIGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgdmFyIHBhdGggPSBrZXkuc3BsaXQoJy4nKSxcbiAgICAgICAgb2JqID0gZ2V0VGFyZ2V0Vk0odGhpcywgcGF0aClcbiAgICBpZiAoIW9iaikgcmV0dXJuXG4gICAgZm9yICh2YXIgZCA9IDAsIGwgPSBwYXRoLmxlbmd0aCAtIDE7IGQgPCBsOyBkKyspIHtcbiAgICAgICAgb2JqID0gb2JqW3BhdGhbZF1dXG4gICAgfVxuICAgIG9ialtwYXRoW2RdXSA9IHZhbHVlXG59KVxuXG4vKipcbiAqICB3YXRjaCBhIGtleSBvbiB0aGUgdmlld21vZGVsIGZvciBjaGFuZ2VzXG4gKiAgZmlyZSBjYWxsYmFjayB3aXRoIG5ldyB2YWx1ZVxuICovXG5kZWYoVk1Qcm90bywgJyR3YXRjaCcsIGZ1bmN0aW9uIChrZXksIGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgZnVuY3Rpb24gb24gKCkge1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50c1xuICAgICAgICB1dGlscy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseShzZWxmLCBhcmdzKVxuICAgICAgICB9KVxuICAgIH1cbiAgICBjYWxsYmFjay5fZm4gPSBvblxuICAgIHNlbGYuJGNvbXBpbGVyLm9ic2VydmVyLm9uKCdjaGFuZ2U6JyArIGtleSwgb24pXG59KVxuXG4vKipcbiAqICB1bndhdGNoIGEga2V5XG4gKi9cbmRlZihWTVByb3RvLCAnJHVud2F0Y2gnLCBmdW5jdGlvbiAoa2V5LCBjYWxsYmFjaykge1xuICAgIC8vIHdvcmthcm91bmQgaGVyZVxuICAgIC8vIHNpbmNlIHRoZSBlbWl0dGVyIG1vZHVsZSBjaGVja3MgY2FsbGJhY2sgZXhpc3RlbmNlXG4gICAgLy8gYnkgY2hlY2tpbmcgdGhlIGxlbmd0aCBvZiBhcmd1bWVudHNcbiAgICB2YXIgYXJncyA9IFsnY2hhbmdlOicgKyBrZXldLFxuICAgICAgICBvYiA9IHRoaXMuJGNvbXBpbGVyLm9ic2VydmVyXG4gICAgaWYgKGNhbGxiYWNrKSBhcmdzLnB1c2goY2FsbGJhY2suX2ZuKVxuICAgIG9iLm9mZi5hcHBseShvYiwgYXJncylcbn0pXG5cbi8qKlxuICogIHVuYmluZCBldmVyeXRoaW5nLCByZW1vdmUgZXZlcnl0aGluZ1xuICovXG5kZWYoVk1Qcm90bywgJyRkZXN0cm95JywgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuJGNvbXBpbGVyLmRlc3Ryb3koKVxufSlcblxuLyoqXG4gKiAgYnJvYWRjYXN0IGFuIGV2ZW50IHRvIGFsbCBjaGlsZCBWTXMgcmVjdXJzaXZlbHkuXG4gKi9cbmRlZihWTVByb3RvLCAnJGJyb2FkY2FzdCcsIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2hpbGRyZW4gPSB0aGlzLiRjb21waWxlci5jaGlsZENvbXBpbGVycyxcbiAgICAgICAgaSA9IGNoaWxkcmVuLmxlbmd0aCxcbiAgICAgICAgY2hpbGRcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGNoaWxkID0gY2hpbGRyZW5baV1cbiAgICAgICAgY2hpbGQuZW1pdHRlci5lbWl0LmFwcGx5KGNoaWxkLmVtaXR0ZXIsIGFyZ3VtZW50cylcbiAgICAgICAgY2hpbGQudm0uJGJyb2FkY2FzdC5hcHBseShjaGlsZC52bSwgYXJndW1lbnRzKVxuICAgIH1cbn0pXG5cbi8qKlxuICogIGVtaXQgYW4gZXZlbnQgdGhhdCBwcm9wYWdhdGVzIGFsbCB0aGUgd2F5IHVwIHRvIHBhcmVudCBWTXMuXG4gKi9cbmRlZihWTVByb3RvLCAnJGRpc3BhdGNoJywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBjb21waWxlciA9IHRoaXMuJGNvbXBpbGVyLFxuICAgICAgICBlbWl0dGVyID0gY29tcGlsZXIuZW1pdHRlcixcbiAgICAgICAgcGFyZW50ID0gY29tcGlsZXIucGFyZW50Q29tcGlsZXJcbiAgICBlbWl0dGVyLmVtaXQuYXBwbHkoZW1pdHRlciwgYXJndW1lbnRzKVxuICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgcGFyZW50LnZtLiRkaXNwYXRjaC5hcHBseShwYXJlbnQudm0sIGFyZ3VtZW50cylcbiAgICB9XG59KVxuXG4vKipcbiAqICBkZWxlZ2F0ZSBvbi9vZmYvb25jZSB0byB0aGUgY29tcGlsZXIncyBlbWl0dGVyXG4gKi9cbjtbJ2VtaXQnLCAnb24nLCAnb2ZmJywgJ29uY2UnXS5mb3JFYWNoKGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgICBkZWYoVk1Qcm90bywgJyQnICsgbWV0aG9kLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBlbWl0dGVyID0gdGhpcy4kY29tcGlsZXIuZW1pdHRlclxuICAgICAgICBlbWl0dGVyW21ldGhvZF0uYXBwbHkoZW1pdHRlciwgYXJndW1lbnRzKVxuICAgIH0pXG59KVxuXG4vLyBET00gY29udmVuaWVuY2UgbWV0aG9kc1xuXG5kZWYoVk1Qcm90bywgJyRhcHBlbmRUbycsIGZ1bmN0aW9uICh0YXJnZXQsIGNiKSB7XG4gICAgdGFyZ2V0ID0gcXVlcnkodGFyZ2V0KVxuICAgIHZhciBlbCA9IHRoaXMuJGVsXG4gICAgdHJhbnNpdGlvbihlbCwgMSwgZnVuY3Rpb24gKCkge1xuICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZWwpXG4gICAgICAgIGlmIChjYikgbmV4dFRpY2soY2IpXG4gICAgfSwgdGhpcy4kY29tcGlsZXIpXG59KVxuXG5kZWYoVk1Qcm90bywgJyRyZW1vdmUnLCBmdW5jdGlvbiAoY2IpIHtcbiAgICB2YXIgZWwgPSB0aGlzLiRlbCxcbiAgICAgICAgcGFyZW50ID0gZWwucGFyZW50Tm9kZVxuICAgIGlmICghcGFyZW50KSByZXR1cm5cbiAgICB0cmFuc2l0aW9uKGVsLCAtMSwgZnVuY3Rpb24gKCkge1xuICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoZWwpXG4gICAgICAgIGlmIChjYikgbmV4dFRpY2soY2IpXG4gICAgfSwgdGhpcy4kY29tcGlsZXIpXG59KVxuXG5kZWYoVk1Qcm90bywgJyRiZWZvcmUnLCBmdW5jdGlvbiAodGFyZ2V0LCBjYikge1xuICAgIHRhcmdldCA9IHF1ZXJ5KHRhcmdldClcbiAgICB2YXIgZWwgPSB0aGlzLiRlbCxcbiAgICAgICAgcGFyZW50ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICBpZiAoIXBhcmVudCkgcmV0dXJuXG4gICAgdHJhbnNpdGlvbihlbCwgMSwgZnVuY3Rpb24gKCkge1xuICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGVsLCB0YXJnZXQpXG4gICAgICAgIGlmIChjYikgbmV4dFRpY2soY2IpXG4gICAgfSwgdGhpcy4kY29tcGlsZXIpXG59KVxuXG5kZWYoVk1Qcm90bywgJyRhZnRlcicsIGZ1bmN0aW9uICh0YXJnZXQsIGNiKSB7XG4gICAgdGFyZ2V0ID0gcXVlcnkodGFyZ2V0KVxuICAgIHZhciBlbCA9IHRoaXMuJGVsLFxuICAgICAgICBwYXJlbnQgPSB0YXJnZXQucGFyZW50Tm9kZSxcbiAgICAgICAgbmV4dCA9IHRhcmdldC5uZXh0U2libGluZ1xuICAgIGlmICghcGFyZW50KSByZXR1cm5cbiAgICB0cmFuc2l0aW9uKGVsLCAxLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKGVsLCBuZXh0KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGVsKVxuICAgICAgICB9XG4gICAgICAgIGlmIChjYikgbmV4dFRpY2soY2IpXG4gICAgfSwgdGhpcy4kY29tcGlsZXIpXG59KVxuXG5mdW5jdGlvbiBxdWVyeSAoZWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIGVsID09PSAnc3RyaW5nJ1xuICAgICAgICA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpXG4gICAgICAgIDogZWxcbn1cblxuLyoqXG4gKiAgSWYgYSBWTSBkb2Vzbid0IGNvbnRhaW4gYSBwYXRoLCBnbyB1cCB0aGUgcHJvdG90eXBlIGNoYWluXG4gKiAgdG8gbG9jYXRlIHRoZSBhbmNlc3RvciB0aGF0IGhhcyBpdC5cbiAqL1xuZnVuY3Rpb24gZ2V0VGFyZ2V0Vk0gKHZtLCBwYXRoKSB7XG4gICAgdmFyIGJhc2VLZXkgPSBwYXRoWzBdLFxuICAgICAgICBiaW5kaW5nID0gdm0uJGNvbXBpbGVyLmJpbmRpbmdzW2Jhc2VLZXldXG4gICAgcmV0dXJuIGJpbmRpbmdcbiAgICAgICAgPyBiaW5kaW5nLmNvbXBpbGVyLnZtXG4gICAgICAgIDogbnVsbFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpZXdNb2RlbCIsImNvbnNvbGUubG9nKHJlcXVpcmUoJy4vdGVtcGxhdGUuaHRtbCcpKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdGNsYXNzTmFtZSA6ICdwcm9kdWN0cycsXG5cdHRlbXBsYXRlIDogcmVxdWlyZSgnLi90ZW1wbGF0ZS5odG1sJyksXG5cdFxuXG4gICAgY29tcHV0ZWQgOiB7XG4gICAgICAgIHRvdGFsIDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnF0eSAqIHRoaXMucHJpY2U7XG4gICAgICAgIH1cbiAgICB9XG59OyIsIm1vZHVsZS5leHBvcnRzID0gXCI8aDQ+e3tuYW1lfX08L2g0PlxcbjxwPnt7dG90YWx9fTwvcD5cIjtcbiIsIlxudmFyIFZ1ZSA9IHJlcXVpcmUoJ3Z1ZScpO1xuXG4gICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2NhbnZhcycpLFxuICAgICAgICBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyksXG4gICAgICAgIGltZ0NvbnRleHQsXG4gICAgICAgICR3cmFwcGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Nhbi13cmFwcGVyJyk7XG5cbiAgICAgICAgJHdyYXBwZXIuc3R5bGUuaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0ICsgMTAwICsgJ3B4JztcbiAgICAgICAgJHdyYXBwZXIuc3R5bGUud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aCArIDEwMCArICdweCc7XG5cbmZ1bmN0aW9uIGJsdXJCb29rQmFja2dyb3VuZCgpIHtcbiAgICBcbiAgICB2YXIgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcblxuICAgIGNhbnZhcy53aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoICogMS42O1xuICAgIGNhbnZhcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQgKiAxLjY7XG5cbiAgICBpbWFnZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkJyxmdW5jdGlvbiBjYigpe1xuXG4gICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKHRoaXMsMTAwLDE4MCw2MDAsNjAwLDAsMCx3aW5kb3cuaW5uZXJXaWR0aCoxLjYsd2luZG93LmlubmVyV2lkdGgqMS42KTtcbiAgICAgICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkJyxjYik7XG4gICAgICAgIGltYWdlQ29udGV4dCA9IHRoaXM7XG5cbiAgICB9LGZhbHNlKTtcblxuICAgIGltYWdlLnNyYyA9ICdpbWFnZXMvZ290eWUuanBnJztcblxufVxuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgZnVuY3Rpb24oKXtcblxuICAgIGNvbnRleHQuZHJhd0ltYWdlKGltYWdlQ29udGV4dCwxMDAsMTgwLDYwMCw2MDAsMCwwLHdpbmRvdy5pbm5lcldpZHRoKjEuNix3aW5kb3cuaW5uZXJXaWR0aCoxLjYpO1xuICAgIFxufSwgZmFsc2UpO1xuXG5ibHVyQm9va0JhY2tncm91bmQoKTtcblxuXG52YXIgZiA9IHtcbiAgICBmb28gOiAnYmFyJ1xufTtcblxudmFyIG8gPSB7fTtcblxudmFyIGtleSA9ICdmb28nO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkobyxrZXksIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIGZba2V5XTsgfSwgXG4gICAgc2V0OiBmdW5jdGlvbiAoeCkgeyBjb25zb2xlLmxvZygnc29tZSBzaGl0IGNoYW5nZWQgdmlhJywga2V5KTsgZltrZXldID0geDsgfVxufSk7XG5cbmNvbnNvbGUubG9nKG8uZm9vKTtcblxuby5mb28gPSAnc3R1ZmYnO1xuXG5jb25zb2xlLmxvZyhvLmZvbyk7XG5cbnZhciBjb250YWluZXIgPSBuZXcgVnVlKHtcblxuICAgIGVsOiAnI3Nob3BwaW5nLWNhcnQnLFxuXG4gICAgY29tcG9uZW50czoge1xuICAgICAgICBwcm9kdWN0czogcmVxdWlyZSgnLi9jb21wb25lbnRzL3Byb2R1Y3RzJylcbiAgICB9LFxuXG4gICAgZGF0YToge1xuICAgICAgICBwcm9kdWN0cyA6IFt7XG4gICAgICAgICAgICBuYW1lIDogJ0ZvbycsXG4gICAgICAgICAgICBxdHkgOiA0LFxuICAgICAgICAgICAgcHJpY2UgOiAyLjk5XG4gICAgICAgIH0se1xuICAgICAgICAgICAgbmFtZSA6ICdGb28yJyxcbiAgICAgICAgICAgIHF0eSA6IDMsXG4gICAgICAgICAgICBwcmljZSA6IDEuOTlcbiAgICAgICAgfV1cbiAgICB9XG59KTtcblxuY29uc29sZS5sb2coIGNvbnRhaW5lci4kICk7Il19

import { jsx, jsxs, Fragment } from "react/jsx-runtime";
function tree_add(d) {
  const x2 = +this._x.call(null, d), y2 = +this._y.call(null, d);
  return add(this.cover(x2, y2), x2, y2, d);
}
function add(tree, x2, y2, d) {
  if (isNaN(x2) || isNaN(y2)) return tree;
  var parent, node = tree._root, leaf = { data: d }, x0 = tree._x0, y0 = tree._y0, x1 = tree._x1, y1 = tree._y1, xm, ym, xp, yp, right, bottom, i, j;
  if (!node) return tree._root = leaf, tree;
  while (node.length) {
    if (right = x2 >= (xm = (x0 + x1) / 2)) x0 = xm;
    else x1 = xm;
    if (bottom = y2 >= (ym = (y0 + y1) / 2)) y0 = ym;
    else y1 = ym;
    if (parent = node, !(node = node[i = bottom << 1 | right])) return parent[i] = leaf, tree;
  }
  xp = +tree._x.call(null, node.data);
  yp = +tree._y.call(null, node.data);
  if (x2 === xp && y2 === yp) return leaf.next = node, parent ? parent[i] = leaf : tree._root = leaf, tree;
  do {
    parent = parent ? parent[i] = new Array(4) : tree._root = new Array(4);
    if (right = x2 >= (xm = (x0 + x1) / 2)) x0 = xm;
    else x1 = xm;
    if (bottom = y2 >= (ym = (y0 + y1) / 2)) y0 = ym;
    else y1 = ym;
  } while ((i = bottom << 1 | right) === (j = (yp >= ym) << 1 | xp >= xm));
  return parent[j] = node, parent[i] = leaf, tree;
}
function addAll(data) {
  var d, i, n = data.length, x2, y2, xz = new Array(n), yz = new Array(n), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (i = 0; i < n; ++i) {
    if (isNaN(x2 = +this._x.call(null, d = data[i])) || isNaN(y2 = +this._y.call(null, d))) continue;
    xz[i] = x2;
    yz[i] = y2;
    if (x2 < x0) x0 = x2;
    if (x2 > x1) x1 = x2;
    if (y2 < y0) y0 = y2;
    if (y2 > y1) y1 = y2;
  }
  if (x0 > x1 || y0 > y1) return this;
  this.cover(x0, y0).cover(x1, y1);
  for (i = 0; i < n; ++i) {
    add(this, xz[i], yz[i], data[i]);
  }
  return this;
}
function tree_cover(x2, y2) {
  if (isNaN(x2 = +x2) || isNaN(y2 = +y2)) return this;
  var x0 = this._x0, y0 = this._y0, x1 = this._x1, y1 = this._y1;
  if (isNaN(x0)) {
    x1 = (x0 = Math.floor(x2)) + 1;
    y1 = (y0 = Math.floor(y2)) + 1;
  } else {
    var z = x1 - x0 || 1, node = this._root, parent, i;
    while (x0 > x2 || x2 >= x1 || y0 > y2 || y2 >= y1) {
      i = (y2 < y0) << 1 | x2 < x0;
      parent = new Array(4), parent[i] = node, node = parent, z *= 2;
      switch (i) {
        case 0:
          x1 = x0 + z, y1 = y0 + z;
          break;
        case 1:
          x0 = x1 - z, y1 = y0 + z;
          break;
        case 2:
          x1 = x0 + z, y0 = y1 - z;
          break;
        case 3:
          x0 = x1 - z, y0 = y1 - z;
          break;
      }
    }
    if (this._root && this._root.length) this._root = node;
  }
  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  return this;
}
function tree_data() {
  var data = [];
  this.visit(function(node) {
    if (!node.length) do
      data.push(node.data);
    while (node = node.next);
  });
  return data;
}
function tree_extent(_) {
  return arguments.length ? this.cover(+_[0][0], +_[0][1]).cover(+_[1][0], +_[1][1]) : isNaN(this._x0) ? void 0 : [[this._x0, this._y0], [this._x1, this._y1]];
}
function Quad(node, x0, y0, x1, y1) {
  this.node = node;
  this.x0 = x0;
  this.y0 = y0;
  this.x1 = x1;
  this.y1 = y1;
}
function tree_find(x2, y2, radius) {
  var data, x0 = this._x0, y0 = this._y0, x1, y1, x22, y22, x3 = this._x1, y3 = this._y1, quads = [], node = this._root, q, i;
  if (node) quads.push(new Quad(node, x0, y0, x3, y3));
  if (radius == null) radius = Infinity;
  else {
    x0 = x2 - radius, y0 = y2 - radius;
    x3 = x2 + radius, y3 = y2 + radius;
    radius *= radius;
  }
  while (q = quads.pop()) {
    if (!(node = q.node) || (x1 = q.x0) > x3 || (y1 = q.y0) > y3 || (x22 = q.x1) < x0 || (y22 = q.y1) < y0) continue;
    if (node.length) {
      var xm = (x1 + x22) / 2, ym = (y1 + y22) / 2;
      quads.push(
        new Quad(node[3], xm, ym, x22, y22),
        new Quad(node[2], x1, ym, xm, y22),
        new Quad(node[1], xm, y1, x22, ym),
        new Quad(node[0], x1, y1, xm, ym)
      );
      if (i = (y2 >= ym) << 1 | x2 >= xm) {
        q = quads[quads.length - 1];
        quads[quads.length - 1] = quads[quads.length - 1 - i];
        quads[quads.length - 1 - i] = q;
      }
    } else {
      var dx = x2 - +this._x.call(null, node.data), dy = y2 - +this._y.call(null, node.data), d2 = dx * dx + dy * dy;
      if (d2 < radius) {
        var d = Math.sqrt(radius = d2);
        x0 = x2 - d, y0 = y2 - d;
        x3 = x2 + d, y3 = y2 + d;
        data = node.data;
      }
    }
  }
  return data;
}
function tree_remove(d) {
  if (isNaN(x2 = +this._x.call(null, d)) || isNaN(y2 = +this._y.call(null, d))) return this;
  var parent, node = this._root, retainer, previous, next, x0 = this._x0, y0 = this._y0, x1 = this._x1, y1 = this._y1, x2, y2, xm, ym, right, bottom, i, j;
  if (!node) return this;
  if (node.length) while (true) {
    if (right = x2 >= (xm = (x0 + x1) / 2)) x0 = xm;
    else x1 = xm;
    if (bottom = y2 >= (ym = (y0 + y1) / 2)) y0 = ym;
    else y1 = ym;
    if (!(parent = node, node = node[i = bottom << 1 | right])) return this;
    if (!node.length) break;
    if (parent[i + 1 & 3] || parent[i + 2 & 3] || parent[i + 3 & 3]) retainer = parent, j = i;
  }
  while (node.data !== d) if (!(previous = node, node = node.next)) return this;
  if (next = node.next) delete node.next;
  if (previous) return next ? previous.next = next : delete previous.next, this;
  if (!parent) return this._root = next, this;
  next ? parent[i] = next : delete parent[i];
  if ((node = parent[0] || parent[1] || parent[2] || parent[3]) && node === (parent[3] || parent[2] || parent[1] || parent[0]) && !node.length) {
    if (retainer) retainer[j] = node;
    else this._root = node;
  }
  return this;
}
function removeAll(data) {
  for (var i = 0, n = data.length; i < n; ++i) this.remove(data[i]);
  return this;
}
function tree_root() {
  return this._root;
}
function tree_size() {
  var size = 0;
  this.visit(function(node) {
    if (!node.length) do
      ++size;
    while (node = node.next);
  });
  return size;
}
function tree_visit(callback) {
  var quads = [], q, node = this._root, child, x0, y0, x1, y1;
  if (node) quads.push(new Quad(node, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    if (!callback(node = q.node, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1) && node.length) {
      var xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
      if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
      if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
      if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
    }
  }
  return this;
}
function tree_visitAfter(callback) {
  var quads = [], next = [], q;
  if (this._root) quads.push(new Quad(this._root, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    var node = q.node;
    if (node.length) {
      var child, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
      if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
      if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
      if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
    }
    next.push(q);
  }
  while (q = next.pop()) {
    callback(q.node, q.x0, q.y0, q.x1, q.y1);
  }
  return this;
}
function defaultX(d) {
  return d[0];
}
function tree_x(_) {
  return arguments.length ? (this._x = _, this) : this._x;
}
function defaultY(d) {
  return d[1];
}
function tree_y(_) {
  return arguments.length ? (this._y = _, this) : this._y;
}
function quadtree(nodes, x2, y2) {
  var tree = new Quadtree(x2 == null ? defaultX : x2, y2 == null ? defaultY : y2, NaN, NaN, NaN, NaN);
  return nodes == null ? tree : tree.addAll(nodes);
}
function Quadtree(x2, y2, x0, y0, x1, y1) {
  this._x = x2;
  this._y = y2;
  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  this._root = void 0;
}
function leaf_copy(leaf) {
  var copy = { data: leaf.data }, next = copy;
  while (leaf = leaf.next) next = next.next = { data: leaf.data };
  return copy;
}
var treeProto = quadtree.prototype = Quadtree.prototype;
treeProto.copy = function() {
  var copy = new Quadtree(this._x, this._y, this._x0, this._y0, this._x1, this._y1), node = this._root, nodes, child;
  if (!node) return copy;
  if (!node.length) return copy._root = leaf_copy(node), copy;
  nodes = [{ source: node, target: copy._root = new Array(4) }];
  while (node = nodes.pop()) {
    for (var i = 0; i < 4; ++i) {
      if (child = node.source[i]) {
        if (child.length) nodes.push({ source: child, target: node.target[i] = new Array(4) });
        else node.target[i] = leaf_copy(child);
      }
    }
  }
  return copy;
};
treeProto.add = tree_add;
treeProto.addAll = addAll;
treeProto.cover = tree_cover;
treeProto.data = tree_data;
treeProto.extent = tree_extent;
treeProto.find = tree_find;
treeProto.remove = tree_remove;
treeProto.removeAll = removeAll;
treeProto.root = tree_root;
treeProto.size = tree_size;
treeProto.visit = tree_visit;
treeProto.visitAfter = tree_visitAfter;
treeProto.x = tree_x;
treeProto.y = tree_y;
function constant(x2) {
  return function() {
    return x2;
  };
}
function jiggle(random) {
  return (random() - 0.5) * 1e-6;
}
function x$1(d) {
  return d.x + d.vx;
}
function y$1(d) {
  return d.y + d.vy;
}
function forceCollide(radius) {
  var nodes, radii, random, strength = 1, iterations = 1;
  if (typeof radius !== "function") radius = constant(radius == null ? 1 : +radius);
  function force() {
    var i, n = nodes.length, tree, node, xi, yi, ri, ri2;
    for (var k = 0; k < iterations; ++k) {
      tree = quadtree(nodes, x$1, y$1).visitAfter(prepare);
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        ri = radii[node.index], ri2 = ri * ri;
        xi = node.x + node.vx;
        yi = node.y + node.vy;
        tree.visit(apply);
      }
    }
    function apply(quad, x0, y0, x1, y1) {
      var data = quad.data, rj = quad.r, r = ri + rj;
      if (data) {
        if (data.index > node.index) {
          var x2 = xi - data.x - data.vx, y2 = yi - data.y - data.vy, l = x2 * x2 + y2 * y2;
          if (l < r * r) {
            if (x2 === 0) x2 = jiggle(random), l += x2 * x2;
            if (y2 === 0) y2 = jiggle(random), l += y2 * y2;
            l = (r - (l = Math.sqrt(l))) / l * strength;
            node.vx += (x2 *= l) * (r = (rj *= rj) / (ri2 + rj));
            node.vy += (y2 *= l) * r;
            data.vx -= x2 * (r = 1 - r);
            data.vy -= y2 * r;
          }
        }
        return;
      }
      return x0 > xi + r || x1 < xi - r || y0 > yi + r || y1 < yi - r;
    }
  }
  function prepare(quad) {
    if (quad.data) return quad.r = radii[quad.data.index];
    for (var i = quad.r = 0; i < 4; ++i) {
      if (quad[i] && quad[i].r > quad.r) {
        quad.r = quad[i].r;
      }
    }
  }
  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, node;
    radii = new Array(n);
    for (i = 0; i < n; ++i) node = nodes[i], radii[node.index] = +radius(node, i, nodes);
  }
  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    random = _random;
    initialize();
  };
  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };
  force.strength = function(_) {
    return arguments.length ? (strength = +_, force) : strength;
  };
  force.radius = function(_) {
    return arguments.length ? (radius = typeof _ === "function" ? _ : constant(+_), initialize(), force) : radius;
  };
  return force;
}
function index(d) {
  return d.index;
}
function find(nodeById, nodeId) {
  var node = nodeById.get(nodeId);
  if (!node) throw new Error("node not found: " + nodeId);
  return node;
}
function forceLink(links) {
  var id = index, strength = defaultStrength, strengths, distance = constant(30), distances, nodes, count, bias, random, iterations = 1;
  if (links == null) links = [];
  function defaultStrength(link) {
    return 1 / Math.min(count[link.source.index], count[link.target.index]);
  }
  function force(alpha) {
    for (var k = 0, n = links.length; k < iterations; ++k) {
      for (var i = 0, link, source, target, x2, y2, l, b; i < n; ++i) {
        link = links[i], source = link.source, target = link.target;
        x2 = target.x + target.vx - source.x - source.vx || jiggle(random);
        y2 = target.y + target.vy - source.y - source.vy || jiggle(random);
        l = Math.sqrt(x2 * x2 + y2 * y2);
        l = (l - distances[i]) / l * alpha * strengths[i];
        x2 *= l, y2 *= l;
        target.vx -= x2 * (b = bias[i]);
        target.vy -= y2 * b;
        source.vx += x2 * (b = 1 - b);
        source.vy += y2 * b;
      }
    }
  }
  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, m2 = links.length, nodeById = new Map(nodes.map((d, i2) => [id(d, i2, nodes), d])), link;
    for (i = 0, count = new Array(n); i < m2; ++i) {
      link = links[i], link.index = i;
      if (typeof link.source !== "object") link.source = find(nodeById, link.source);
      if (typeof link.target !== "object") link.target = find(nodeById, link.target);
      count[link.source.index] = (count[link.source.index] || 0) + 1;
      count[link.target.index] = (count[link.target.index] || 0) + 1;
    }
    for (i = 0, bias = new Array(m2); i < m2; ++i) {
      link = links[i], bias[i] = count[link.source.index] / (count[link.source.index] + count[link.target.index]);
    }
    strengths = new Array(m2), initializeStrength();
    distances = new Array(m2), initializeDistance();
  }
  function initializeStrength() {
    if (!nodes) return;
    for (var i = 0, n = links.length; i < n; ++i) {
      strengths[i] = +strength(links[i], i, links);
    }
  }
  function initializeDistance() {
    if (!nodes) return;
    for (var i = 0, n = links.length; i < n; ++i) {
      distances[i] = +distance(links[i], i, links);
    }
  }
  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    random = _random;
    initialize();
  };
  force.links = function(_) {
    return arguments.length ? (links = _, initialize(), force) : links;
  };
  force.id = function(_) {
    return arguments.length ? (id = _, force) : id;
  };
  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };
  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initializeStrength(), force) : strength;
  };
  force.distance = function(_) {
    return arguments.length ? (distance = typeof _ === "function" ? _ : constant(+_), initializeDistance(), force) : distance;
  };
  return force;
}
var noop = { value: () => {
} };
function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}
function Dispatch(_) {
  this._ = _;
}
function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return { type: t, name };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._, T = parseTypenames(typename + "", _), t, i = -1, n = T.length;
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};
function get(type, name) {
  for (var i = 0, n = type.length, c2; i < n; ++i) {
    if ((c2 = type[i]).name === name) {
      return c2.value;
    }
  }
}
function set(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({ name, value: callback });
  return type;
}
var frame = 0, timeout = 0, interval = 0, pokeDelay = 1e3, taskHead, taskTail, clockLast = 0, clockNow = 0, clockSkew = 0, clock = typeof performance === "object" && performance.now ? performance : Date, setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
  setTimeout(f, 17);
};
function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
  clockNow = 0;
}
function Timer() {
  this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};
function timer(callback, delay, time) {
  var t = new Timer();
  t.restart(callback, delay, time);
  return t;
}
function timerFlush() {
  now();
  ++frame;
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
    t = t._next;
  }
  --frame;
}
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
function poke() {
  var now2 = clock.now(), delay = now2 - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
}
function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}
function sleep(time) {
  if (frame) return;
  if (timeout) timeout = clearTimeout(timeout);
  var delay = time - clockNow;
  if (delay > 24) {
    if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}
const a = 1664525;
const c = 1013904223;
const m = 4294967296;
function lcg() {
  let s = 1;
  return () => (s = (a * s + c) % m) / m;
}
function x(d) {
  return d.x;
}
function y(d) {
  return d.y;
}
var initialRadius = 10, initialAngle = Math.PI * (3 - Math.sqrt(5));
function forceSimulation(nodes) {
  var simulation, alpha = 1, alphaMin = 1e-3, alphaDecay = 1 - Math.pow(alphaMin, 1 / 300), alphaTarget = 0, velocityDecay = 0.6, forces = /* @__PURE__ */ new Map(), stepper = timer(step), event = dispatch("tick", "end"), random = lcg();
  if (nodes == null) nodes = [];
  function step() {
    tick();
    event.call("tick", simulation);
    if (alpha < alphaMin) {
      stepper.stop();
      event.call("end", simulation);
    }
  }
  function tick(iterations) {
    var i, n = nodes.length, node;
    if (iterations === void 0) iterations = 1;
    for (var k = 0; k < iterations; ++k) {
      alpha += (alphaTarget - alpha) * alphaDecay;
      forces.forEach(function(force) {
        force(alpha);
      });
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        if (node.fx == null) node.x += node.vx *= velocityDecay;
        else node.x = node.fx, node.vx = 0;
        if (node.fy == null) node.y += node.vy *= velocityDecay;
        else node.y = node.fy, node.vy = 0;
      }
    }
    return simulation;
  }
  function initializeNodes() {
    for (var i = 0, n = nodes.length, node; i < n; ++i) {
      node = nodes[i], node.index = i;
      if (node.fx != null) node.x = node.fx;
      if (node.fy != null) node.y = node.fy;
      if (isNaN(node.x) || isNaN(node.y)) {
        var radius = initialRadius * Math.sqrt(0.5 + i), angle = i * initialAngle;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
      }
      if (isNaN(node.vx) || isNaN(node.vy)) {
        node.vx = node.vy = 0;
      }
    }
  }
  function initializeForce(force) {
    if (force.initialize) force.initialize(nodes, random);
    return force;
  }
  initializeNodes();
  return simulation = {
    tick,
    restart: function() {
      return stepper.restart(step), simulation;
    },
    stop: function() {
      return stepper.stop(), simulation;
    },
    nodes: function(_) {
      return arguments.length ? (nodes = _, initializeNodes(), forces.forEach(initializeForce), simulation) : nodes;
    },
    alpha: function(_) {
      return arguments.length ? (alpha = +_, simulation) : alpha;
    },
    alphaMin: function(_) {
      return arguments.length ? (alphaMin = +_, simulation) : alphaMin;
    },
    alphaDecay: function(_) {
      return arguments.length ? (alphaDecay = +_, simulation) : +alphaDecay;
    },
    alphaTarget: function(_) {
      return arguments.length ? (alphaTarget = +_, simulation) : alphaTarget;
    },
    velocityDecay: function(_) {
      return arguments.length ? (velocityDecay = 1 - _, simulation) : 1 - velocityDecay;
    },
    randomSource: function(_) {
      return arguments.length ? (random = _, forces.forEach(initializeForce), simulation) : random;
    },
    force: function(name, _) {
      return arguments.length > 1 ? (_ == null ? forces.delete(name) : forces.set(name, initializeForce(_)), simulation) : forces.get(name);
    },
    find: function(x2, y2, radius) {
      var i = 0, n = nodes.length, dx, dy, d2, node, closest;
      if (radius == null) radius = Infinity;
      else radius *= radius;
      for (i = 0; i < n; ++i) {
        node = nodes[i];
        dx = x2 - node.x;
        dy = y2 - node.y;
        d2 = dx * dx + dy * dy;
        if (d2 < radius) closest = node, radius = d2;
      }
      return closest;
    },
    on: function(name, _) {
      return arguments.length > 1 ? (event.on(name, _), simulation) : event.on(name);
    }
  };
}
function forceManyBody() {
  var nodes, node, random, alpha, strength = constant(-30), strengths, distanceMin2 = 1, distanceMax2 = Infinity, theta2 = 0.81;
  function force(_) {
    var i, n = nodes.length, tree = quadtree(nodes, x, y).visitAfter(accumulate);
    for (alpha = _, i = 0; i < n; ++i) node = nodes[i], tree.visit(apply);
  }
  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length, node2;
    strengths = new Array(n);
    for (i = 0; i < n; ++i) node2 = nodes[i], strengths[node2.index] = +strength(node2, i, nodes);
  }
  function accumulate(quad) {
    var strength2 = 0, q, c2, weight = 0, x2, y2, i;
    if (quad.length) {
      for (x2 = y2 = i = 0; i < 4; ++i) {
        if ((q = quad[i]) && (c2 = Math.abs(q.value))) {
          strength2 += q.value, weight += c2, x2 += c2 * q.x, y2 += c2 * q.y;
        }
      }
      quad.x = x2 / weight;
      quad.y = y2 / weight;
    } else {
      q = quad;
      q.x = q.data.x;
      q.y = q.data.y;
      do
        strength2 += strengths[q.data.index];
      while (q = q.next);
    }
    quad.value = strength2;
  }
  function apply(quad, x1, _, x2) {
    if (!quad.value) return true;
    var x3 = quad.x - node.x, y2 = quad.y - node.y, w = x2 - x1, l = x3 * x3 + y2 * y2;
    if (w * w / theta2 < l) {
      if (l < distanceMax2) {
        if (x3 === 0) x3 = jiggle(random), l += x3 * x3;
        if (y2 === 0) y2 = jiggle(random), l += y2 * y2;
        if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
        node.vx += x3 * quad.value * alpha / l;
        node.vy += y2 * quad.value * alpha / l;
      }
      return true;
    } else if (quad.length || l >= distanceMax2) return;
    if (quad.data !== node || quad.next) {
      if (x3 === 0) x3 = jiggle(random), l += x3 * x3;
      if (y2 === 0) y2 = jiggle(random), l += y2 * y2;
      if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
    }
    do
      if (quad.data !== node) {
        w = strengths[quad.data.index] * alpha / l;
        node.vx += x3 * w;
        node.vy += y2 * w;
      }
    while (quad = quad.next);
  }
  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    random = _random;
    initialize();
  };
  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initialize(), force) : strength;
  };
  force.distanceMin = function(_) {
    return arguments.length ? (distanceMin2 = _ * _, force) : Math.sqrt(distanceMin2);
  };
  force.distanceMax = function(_) {
    return arguments.length ? (distanceMax2 = _ * _, force) : Math.sqrt(distanceMax2);
  };
  force.theta = function(_) {
    return arguments.length ? (theta2 = _ * _, force) : Math.sqrt(theta2);
  };
  return force;
}
function forceRadial(radius, x2, y2) {
  var nodes, strength = constant(0.1), strengths, radiuses;
  if (typeof radius !== "function") radius = constant(+radius);
  if (x2 == null) x2 = 0;
  if (y2 == null) y2 = 0;
  function force(alpha) {
    for (var i = 0, n = nodes.length; i < n; ++i) {
      var node = nodes[i], dx = node.x - x2 || 1e-6, dy = node.y - y2 || 1e-6, r = Math.sqrt(dx * dx + dy * dy), k = (radiuses[i] - r) * strengths[i] * alpha / r;
      node.vx += dx * k;
      node.vy += dy * k;
    }
  }
  function initialize() {
    if (!nodes) return;
    var i, n = nodes.length;
    strengths = new Array(n);
    radiuses = new Array(n);
    for (i = 0; i < n; ++i) {
      radiuses[i] = +radius(nodes[i], i, nodes);
      strengths[i] = isNaN(radiuses[i]) ? 0 : +strength(nodes[i], i, nodes);
    }
  }
  force.initialize = function(_) {
    nodes = _, initialize();
  };
  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initialize(), force) : strength;
  };
  force.radius = function(_) {
    return arguments.length ? (radius = typeof _ === "function" ? _ : constant(+_), initialize(), force) : radius;
  };
  force.x = function(_) {
    return arguments.length ? (x2 = +_, force) : x2;
  };
  force.y = function(_) {
    return arguments.length ? (y2 = +_, force) : y2;
  };
  return force;
}
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect, useState, useRef } = React;
  const { Share2, GitBranch, Maximize2 } = icons;
  const useNav = sdk.create(() => ({
    treeId: null,
    selectedNid: null,
    selectedLexId: null
  }));
  const selectByNid = (treeId, nid) => {
    const node = store.getPosts("node").find((n) => n.parentId === treeId && String(n.data.nodeId) === nid);
    useNav.setState({ selectedNid: nid, selectedLexId: null });
    if (node) sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: node.id } });
  };
  const selectByLex = (lexId) => {
    useNav.setState({ selectedLexId: lexId, selectedNid: null });
  };
  const CAT_COLORS = {
    motyw: "#f59e0b",
    topos: "#ef4444",
    gatunek: "#4a90e2",
    srodek: "#9b59b6",
    srodek_stylistyczny: "#9b59b6",
    postac: "#22c55e",
    pojecie: "#fde68a",
    "pojęcie": "#fde68a"
  };
  const catColor = (c2) => CAT_COLORS[c2] || "#94a3b8";
  const COLOR_MAP = {
    primary: "#4a90e2",
    secondary: "#9b59b6",
    accent: "#e91e63",
    info: "#00bcd4",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    neutral: "#94a3b8"
  };
  const PALETTE = ["#4a90e2", "#e91e63", "#22c55e", "#f59e0b", "#9b59b6", "#00bcd4", "#ef4444", "#94a3b8"];
  const usedBranchInfos = (nodes, branches) => {
    const byKey = new Map(branches.map((b) => [String(b.data.key), b]));
    const used = [];
    const seen = /* @__PURE__ */ new Set();
    for (const b of branches) {
      const k = String(b.data.key);
      if (!seen.has(k) && nodes.some((n) => String(n.data.branch || "") === k)) {
        used.push(k);
        seen.add(k);
      }
    }
    if (nodes.some((n) => !String(n.data.branch || ""))) used.push("_none");
    return used.map((k, i) => {
      const def = byKey.get(k);
      const colorKey = def ? String(def.data.color || "") : "";
      return {
        key: k,
        label: def ? String(def.data.label) : "bez gałęzi",
        color: COLOR_MAP[colorKey] || PALETTE[i % PALETTE.length],
        def
      };
    });
  };
  const branchOf = (n) => String(n.data.branch || "") || "_none";
  function LeftPanel() {
    const trees = store.usePosts("tree");
    const { treeId, selectedNid } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const branches = store.useChildren(treeId || "", "branch");
    const sharedTreeId = sdk.shared((s) => {
      var _a;
      return (_a = s == null ? void 0 : s.bq) == null ? void 0 : _a.treeId;
    });
    useEffect(() => {
      var _a;
      if (treeId) return;
      const initial = sharedTreeId && trees.some((t) => t.id === sharedTreeId) ? sharedTreeId : (_a = trees[0]) == null ? void 0 : _a.id;
      if (initial) useNav.setState({ treeId: initial });
    }, [trees.length, sharedTreeId]);
    const groups = useMemo(() => {
      return usedBranchInfos(nodes, branches).map((info) => {
        const inBranch = nodes.filter((n) => branchOf(n) === info.key);
        const sorted = [...inBranch].sort((a2, c2) => {
          const ta = parseInt(String(a2.data.tier || "1"), 10) || 1;
          const tc = parseInt(String(c2.data.tier || "1"), 10) || 1;
          return ta - tc;
        });
        return { ...info, nodes: sorted };
      });
    }, [nodes, branches]);
    if (trees.length === 0) {
      return /* @__PURE__ */ jsx(
        ui.Box,
        {
          header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Kosmos BQ" }),
          body: /* @__PURE__ */ jsx(ui.Placeholder, { text: "Brak drzew. Wczytaj paczkę w pluginie BrainQuest." })
        }
      );
    }
    return /* @__PURE__ */ jsx(
      ui.Box,
      {
        header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Kosmos BQ" }),
        body: /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsx(ui.Field, { label: "Drzewo", children: /* @__PURE__ */ jsx(
            ui.Select,
            {
              value: treeId || "",
              options: trees.map((t) => ({ value: t.id, label: String(t.data.title) })),
              onChange: (e) => useNav.setState({ treeId: e.target.value, selectedNid: null })
            }
          ) }),
          /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "xs", children: [
            nodes.length,
            " węzłów · ",
            groups.length,
            " gałęzi"
          ] }),
          groups.map((g) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
            /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
              /* @__PURE__ */ jsx("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 4, background: g.color, marginRight: 6 } }),
              g.label
            ] }),
            g.nodes.map((n) => {
              const nid = String(n.data.nodeId);
              return /* @__PURE__ */ jsx(
                ui.ListItem,
                {
                  active: selectedNid === nid,
                  label: String(n.data.title),
                  detail: `tier ${n.data.tier ?? "?"}`,
                  onClick: () => selectByNid(treeId, nid)
                },
                n.id
              );
            })
          ] }, g.key))
        ] })
      }
    );
  }
  function GraphView() {
    const { treeId, selectedNid, selectedLexId } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const edges = store.useChildren(treeId || "", "edge");
    const branches = store.useChildren(treeId || "", "branch");
    const relTypes = store.useChildren(treeId || "", "relType");
    const lexicons = store.useChildren(treeId || "", "lexicon");
    const allLexNodes = store.usePosts("lexNode");
    const { lexsByNid, nidsByLex } = useMemo(() => {
      const lexById = new Map(lexicons.map((l) => [l.id, l]));
      const lexsByNid2 = /* @__PURE__ */ new Map();
      const nidsByLex2 = /* @__PURE__ */ new Map();
      for (const ln of allLexNodes) {
        const lex = lexById.get(ln.parentId);
        if (!lex) continue;
        const nid = String(ln.data.nid);
        if (!lexsByNid2.has(nid)) lexsByNid2.set(nid, []);
        lexsByNid2.get(nid).push(lex);
        if (!nidsByLex2.has(lex.id)) nidsByLex2.set(lex.id, /* @__PURE__ */ new Set());
        nidsByLex2.get(lex.id).add(nid);
      }
      return { lexsByNid: lexsByNid2, nidsByLex: nidsByLex2 };
    }, [lexicons, allLexNodes]);
    const contextEdges = useMemo(() => {
      const map = /* @__PURE__ */ new Map();
      for (const lex of lexicons) {
        const nidsArr = Array.from(nidsByLex.get(lex.id) || []);
        if (nidsArr.length < 2) continue;
        const rel = String(lex.data.relation || "inne");
        for (let i = 0; i < nidsArr.length; i++)
          for (let j = i + 1; j < nidsArr.length; j++) {
            const [a2, b] = [nidsArr[i], nidsArr[j]].sort();
            const key = `${a2}:${b}`;
            if (!map.has(key)) map.set(key, { from: a2, to: b, rels: /* @__PURE__ */ new Map() });
            const e = map.get(key);
            e.rels.set(rel, (e.rels.get(rel) || 0) + 1);
          }
      }
      const relMap = new Map(relTypes.map((r) => [String(r.data.key), r]));
      const out = [];
      for (const { from, to, rels } of map.values()) {
        let best = "inne", bestCount = 0, total = 0;
        for (const [r, c2] of rels) {
          total += c2;
          if (c2 > bestCount) {
            best = r;
            bestCount = c2;
          }
        }
        const def = relMap.get(best);
        out.push({
          from,
          to,
          relation: best,
          relLabel: def ? String(def.data.label) : best,
          relColor: COLOR_MAP[String((def == null ? void 0 : def.data.color) || "")] || "#94a3b8",
          count: total,
          strength: Math.min(0.4 + total * 0.15, 0.9)
        });
      }
      return out;
    }, [lexicons, relTypes, nidsByLex]);
    const highlightedNids = selectedLexId ? nidsByLex.get(selectedLexId) || /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set();
    const relatedLexIds = useMemo(() => {
      if (!selectedLexId) return /* @__PURE__ */ new Set();
      const myNids = nidsByLex.get(selectedLexId) || /* @__PURE__ */ new Set();
      const ids = /* @__PURE__ */ new Set();
      for (const nid of myNids) {
        const here = lexsByNid.get(nid) || [];
        for (const l of here) if (l.id !== selectedLexId) ids.add(l.id);
      }
      return ids;
    }, [selectedLexId, nidsByLex, lexsByNid]);
    const cx = 300, cy = 300;
    const { positions, orbits } = useMemo(() => {
      const rMin = 110;
      const minArc = 38;
      const baseStep = 95;
      const countPerKey = /* @__PURE__ */ new Map();
      for (const n of nodes) {
        const k = branchOf(n);
        countPerKey.set(k, (countPerKey.get(k) || 0) + 1);
      }
      let prevR = rMin;
      const orbits2 = usedBranchInfos(nodes, branches).map((info, i) => {
        const cnt = countPerKey.get(info.key) || 1;
        const required = cnt * minArc / (2 * Math.PI);
        const r = Math.max(prevR + (i === 0 ? 0 : baseStep), required);
        prevR = r;
        return { ...info, radius: r };
      });
      const simNodes = [];
      for (const orbit of orbits2) {
        const onOrbit = nodes.filter((n) => branchOf(n) === orbit.key);
        onOrbit.forEach((n, j) => {
          const a2 = j / Math.max(onOrbit.length, 1) * Math.PI * 2 - Math.PI / 2;
          simNodes.push({
            id: String(n.data.nodeId),
            x: cx + Math.cos(a2) * orbit.radius,
            y: cy + Math.sin(a2) * orbit.radius,
            r: orbit.radius,
            color: orbit.color,
            branch: orbit.key
          });
        });
      }
      const nidSet = new Set(simNodes.map((n) => n.id));
      const simLinks = edges.map((e) => ({ source: String(e.data.fromNid), target: String(e.data.toNid) })).filter((l) => nidSet.has(l.source) && nidSet.has(l.target));
      const sim = forceSimulation(simNodes).force("radial", forceRadial((d) => d.r, cx, cy).strength(0.9)).force("collide", forceCollide(26)).force("link", forceLink(simLinks).id((d) => d.id).distance(80).strength(0.18)).force("charge", forceManyBody().strength(-22)).stop();
      for (let i = 0; i < 150; i++) sim.tick();
      const positions2 = /* @__PURE__ */ new Map();
      for (const sn of simNodes) {
        positions2.set(sn.id, { x: sn.x, y: sn.y, color: sn.color });
      }
      return { positions: positions2, orbits: orbits2 };
    }, [nodes, branches, edges]);
    if (nodes.length === 0) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Drzewo nie ma węzłów" });
    return /* @__PURE__ */ jsx(
      CosmosSvg,
      {
        cx,
        cy,
        orbits,
        positions,
        nodes,
        edges,
        contextEdges,
        lexsByNid,
        selectedNid,
        selectedLexId,
        relatedLexIds,
        highlightedNids,
        treeId
      }
    );
  }
  function CosmosSvg(props) {
    const {
      cx,
      cy,
      orbits,
      positions,
      nodes,
      edges,
      contextEdges,
      lexsByNid,
      selectedNid,
      selectedLexId,
      relatedLexIds,
      highlightedNids,
      treeId
    } = props;
    const svgRef = useRef(null);
    const gRef = useRef(null);
    const viewRef = useRef({ zoom: 1, x: 0, y: 0 });
    const dragRef = useRef(null);
    const wasMovedRef = useRef(false);
    const [zoomPct, setZoomPct] = useState(100);
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(null);
    const applyView = () => {
      var _a;
      const v = viewRef.current;
      (_a = gRef.current) == null ? void 0 : _a.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.zoom})`);
    };
    const reset = () => {
      viewRef.current = { zoom: 1, x: 0, y: 0 };
      applyView();
      setZoomPct(100);
    };
    const screenToVb = (clientX, clientY) => {
      var _a;
      const rect = (_a = svgRef.current) == null ? void 0 : _a.getBoundingClientRect();
      if (!rect) return { x: 300, y: 300 };
      const size = Math.min(rect.width, rect.height);
      const offX = (rect.width - size) / 2;
      const offY = (rect.height - size) / 2;
      return {
        x: (clientX - rect.left - offX) / size * 600,
        y: (clientY - rect.top - offY) / size * 600
      };
    };
    const onWheel = (e) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const { x: px, y: py } = screenToVb(e.clientX, e.clientY);
      const v = viewRef.current;
      const z = Math.max(0.5, Math.min(5, v.zoom * factor));
      const k = z / v.zoom;
      viewRef.current = { zoom: z, x: px - k * (px - v.x), y: py - k * (py - v.y) };
      applyView();
      setZoomPct(Math.round(z * 100));
    };
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      const v = viewRef.current;
      dragRef.current = { sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false };
      setDragging(true);
      if (hovered) setHovered(null);
    };
    const onMouseMove = (e) => {
      var _a;
      const d = dragRef.current;
      if (!d) return;
      const rect = (_a = svgRef.current) == null ? void 0 : _a.getBoundingClientRect();
      if (!rect) return;
      const size = Math.min(rect.width, rect.height);
      const dx = (e.clientX - d.sx) / size * 600;
      const dy = (e.clientY - d.sy) / size * 600;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true;
      viewRef.current.x = d.vx + dx;
      viewRef.current.y = d.vy + dy;
      applyView();
    };
    const finishDrag = () => {
      var _a;
      wasMovedRef.current = ((_a = dragRef.current) == null ? void 0 : _a.moved) || false;
      dragRef.current = null;
      setDragging(false);
    };
    const tryClick = (cb) => {
      if (wasMovedRef.current) {
        wasMovedRef.current = false;
        return;
      }
      cb();
    };
    const setHoverIfIdle = (nid) => {
      if (dragRef.current) return;
      setHovered((prev) => prev === nid ? prev : nid);
    };
    const onBackgroundClick = () => {
      if (wasMovedRef.current) {
        wasMovedRef.current = false;
        return;
      }
      useNav.setState({ selectedNid: null, selectedLexId: null });
    };
    const focusNid = selectedNid;
    const neighborSet = useMemo(() => {
      if (!focusNid) return null;
      const set2 = /* @__PURE__ */ new Set([focusNid]);
      for (const e of edges) {
        const f = String(e.data.fromNid), t = String(e.data.toNid);
        if (f === focusNid) set2.add(t);
        if (t === focusNid) set2.add(f);
      }
      for (const ce of contextEdges) {
        if (ce.from === focusNid) set2.add(ce.to);
        if (ce.to === focusNid) set2.add(ce.from);
      }
      return set2;
    }, [focusNid, edges, contextEdges]);
    const isNodeDimmed = (nid) => !!neighborSet && !neighborSet.has(nid);
    const isEdgeFocused = (a2, b) => !!neighborSet && (a2 === focusNid || b === focusNid);
    const isEdgeRelevant = (a2, b) => !!neighborSet && neighborSet.has(a2) && neighborSet.has(b);
    const showAllLabels = zoomPct >= 150;
    const labelOpacity = (sel, hov) => sel ? 1 : hov ? 0.95 : showAllLabels ? 0.8 : 0;
    const Label = (p) => /* @__PURE__ */ jsx(
      "text",
      {
        x: p.x,
        y: p.y,
        textAnchor: "middle",
        fontSize: p.size ?? 10,
        fill: p.color,
        opacity: p.opacity ?? 1,
        style: {
          pointerEvents: "none",
          paintOrder: "stroke",
          letterSpacing: p.uppercase ? 0.6 : 0.2,
          fontWeight: p.weight ?? 500,
          textTransform: p.uppercase ? "uppercase" : "none"
        },
        stroke: "#0a0e1a",
        strokeWidth: 2.5,
        strokeOpacity: 0.85,
        children: p.text
      }
    );
    const orbitsLayer = useMemo(() => {
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        orbits.map((o) => /* @__PURE__ */ jsx(
          "circle",
          {
            cx,
            cy,
            r: o.radius,
            fill: "none",
            stroke: o.color,
            strokeOpacity: 0.35,
            strokeDasharray: "3 5"
          },
          "o-" + o.key
        )),
        orbits.map((o) => /* @__PURE__ */ jsx(
          Label,
          {
            x: cx,
            y: cy - o.radius - 6,
            text: o.label,
            color: o.color,
            size: 9,
            opacity: 0.85,
            weight: 600,
            uppercase: true
          },
          "ol-" + o.key
        ))
      ] });
    }, [orbits, cx, cy]);
    const edgesLayer = useMemo(() => {
      return /* @__PURE__ */ jsx(Fragment, { children: edges.map((e) => {
        const fromNid = String(e.data.fromNid), toNid = String(e.data.toNid);
        const a2 = positions.get(fromNid);
        const b = positions.get(toNid);
        if (!a2 || !b) return null;
        const op = !neighborSet ? 0.18 : isEdgeFocused(fromNid, toNid) ? 0.7 : isEdgeRelevant(fromNid, toNid) ? 0.3 : 0.02;
        const showLabel = e.data.type && (!neighborSet || isEdgeFocused(fromNid, toNid));
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx(
            "line",
            {
              x1: a2.x,
              y1: a2.y,
              x2: b.x,
              y2: b.y,
              stroke: "#fff",
              strokeOpacity: op,
              strokeWidth: op > 0.3 ? 1.5 : 1
            }
          ),
          showLabel && /* @__PURE__ */ jsx(
            Label,
            {
              x: (a2.x + b.x) / 2,
              y: (a2.y + b.y) / 2 - 4,
              text: String(e.data.type),
              color: "#cbd5e1",
              size: 9,
              opacity: 0.9,
              weight: 500
            }
          )
        ] }, e.id);
      }) });
    }, [edges, positions, neighborSet, focusNid]);
    const contextLayer = useMemo(() => {
      return /* @__PURE__ */ jsx(Fragment, { children: contextEdges.map((ce, i) => {
        const a2 = positions.get(ce.from);
        const b = positions.get(ce.to);
        if (!a2 || !b) return null;
        const w = 1 + Math.min(ce.count - 1, 2) * 0.4;
        const idleOp = ce.count < 2 ? 0 : Math.min(0.12 + ce.strength * 0.15, 0.3);
        const op = !neighborSet ? idleOp : isEdgeFocused(ce.from, ce.to) ? Math.min(0.5 + ce.strength * 0.4, 0.9) : isEdgeRelevant(ce.from, ce.to) ? 0.25 : 0.02;
        const showLabel = neighborSet && isEdgeFocused(ce.from, ce.to);
        return /* @__PURE__ */ jsxs("g", { children: [
          /* @__PURE__ */ jsx(
            "line",
            {
              x1: a2.x,
              y1: a2.y,
              x2: b.x,
              y2: b.y,
              stroke: ce.relColor,
              strokeOpacity: op,
              strokeWidth: w,
              strokeLinecap: "round"
            }
          ),
          showLabel && /* @__PURE__ */ jsx(
            Label,
            {
              x: (a2.x + b.x) / 2,
              y: (a2.y + b.y) / 2 - 4,
              text: `${ce.relLabel}${ce.count > 1 ? ` ·${ce.count}` : ""}`,
              color: ce.relColor,
              size: 8,
              opacity: 0.95,
              weight: 600
            }
          )
        ] }, `ctx-${i}`);
      }) });
    }, [contextEdges, positions, neighborSet, focusNid]);
    const highlightLines = useMemo(() => {
      if (!selectedLexId) return null;
      const nids = Array.from(highlightedNids);
      const lines = [];
      for (let i = 0; i < nids.length; i++) {
        for (let j = i + 1; j < nids.length; j++) {
          const a2 = positions.get(nids[i]);
          const b = positions.get(nids[j]);
          if (!a2 || !b) continue;
          lines.push(
            /* @__PURE__ */ jsx(
              "line",
              {
                x1: a2.x,
                y1: a2.y,
                x2: b.x,
                y2: b.y,
                stroke: "#fde68a",
                strokeOpacity: 0.55,
                strokeWidth: 1.5
              },
              `hl-${i}-${j}`
            )
          );
        }
      }
      return /* @__PURE__ */ jsx(Fragment, { children: lines });
    }, [selectedLexId, highlightedNids, positions]);
    const planetsLayer = useMemo(() => {
      return /* @__PURE__ */ jsx(Fragment, { children: nodes.map((n) => {
        const nid = String(n.data.nodeId);
        const p = positions.get(nid);
        if (!p) return null;
        const isSel = selectedNid === nid;
        const isHl = highlightedNids.has(nid);
        const lexs = lexsByNid.get(nid) || [];
        const dimmed = isNodeDimmed(nid);
        return /* @__PURE__ */ jsxs(
          "g",
          {
            onMouseEnter: () => setHoverIfIdle(nid),
            onMouseLeave: () => setHoverIfIdle(null),
            style: { opacity: dimmed ? 0.25 : 1, transition: "opacity 150ms" },
            children: [
              (isSel || isHl) && /* @__PURE__ */ jsx(
                "circle",
                {
                  cx: p.x,
                  cy: p.y,
                  r: 22,
                  fill: isHl ? "#fde68a" : p.color,
                  opacity: 0.3
                }
              ),
              /* @__PURE__ */ jsx(
                "circle",
                {
                  cx: p.x,
                  cy: p.y,
                  r: isSel ? 14 : 10,
                  fill: p.color,
                  stroke: isSel || isHl ? "#fff" : "none",
                  strokeWidth: 2,
                  style: { cursor: "pointer" },
                  onClick: (e) => {
                    e.stopPropagation();
                    tryClick(() => selectByNid(treeId, nid));
                  }
                }
              ),
              lexs.map((lex, i) => {
                const ang = i / Math.max(lexs.length, 1) * Math.PI * 2;
                const mx = p.x + Math.cos(ang) * 22;
                const my = p.y + Math.sin(ang) * 22;
                const mc = catColor(String(lex.data.category || ""));
                const moonSel = selectedLexId === lex.id;
                const moonRel = relatedLexIds.has(lex.id);
                return /* @__PURE__ */ jsxs("g", { children: [
                  moonRel && /* @__PURE__ */ jsx("circle", { cx: mx, cy: my, r: 6, fill: "none", stroke: "#fde68a", strokeOpacity: 0.55, strokeWidth: 1 }),
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: mx,
                      cy: my,
                      r: moonSel ? 4.5 : 3,
                      fill: mc,
                      stroke: moonSel ? "#fff" : "none",
                      strokeWidth: 1,
                      style: { cursor: "pointer" },
                      onClick: (e) => {
                        e.stopPropagation();
                        tryClick(() => selectByLex(lex.id));
                      },
                      children: /* @__PURE__ */ jsxs("title", { children: [
                        String(lex.data.term),
                        " · ",
                        String(lex.data.category || "inne")
                      ] })
                    }
                  )
                ] }, lex.id);
              })
            ]
          },
          n.id
        );
      }) });
    }, [nodes, positions, lexsByNid, selectedNid, selectedLexId, relatedLexIds, highlightedNids, treeId, neighborSet]);
    const labelsLayer = useMemo(() => {
      const z = Math.max(zoomPct / 100, 1);
      const fs = 10 / z;
      return /* @__PURE__ */ jsx(Fragment, { children: nodes.map((n) => {
        const nid = String(n.data.nodeId);
        const p = positions.get(nid);
        if (!p) return null;
        const isSel = selectedNid === nid;
        const isHl = highlightedNids.has(nid);
        const isHov = hovered === nid;
        const op = labelOpacity(isSel || isHl, isHov);
        if (op <= 0) return null;
        return /* @__PURE__ */ jsx(
          Label,
          {
            x: p.x,
            y: p.y + 30,
            text: String(n.data.title),
            color: "#fff",
            size: fs,
            opacity: op,
            weight: 500
          },
          n.id
        );
      }) });
    }, [nodes, positions, selectedNid, highlightedNids, hovered, zoomPct]);
    return /* @__PURE__ */ jsxs("div", { style: { position: "relative", width: "100%", height: "100%" }, children: [
      /* @__PURE__ */ jsx(
        "svg",
        {
          ref: svgRef,
          viewBox: "0 0 600 600",
          preserveAspectRatio: "xMidYMid meet",
          style: { display: "block", width: "100%", height: "100%", background: "radial-gradient(ellipse at center, #1a2440 0%, #0a0e1a 100%)", borderRadius: 8, cursor: dragging ? "grabbing" : "grab", userSelect: "none" },
          onWheel,
          onMouseDown,
          onMouseMove,
          onMouseUp: finishDrag,
          onMouseLeave: finishDrag,
          onClick: onBackgroundClick,
          children: /* @__PURE__ */ jsxs("g", { ref: gRef, children: [
            orbitsLayer,
            /* @__PURE__ */ jsx("circle", { cx, cy, r: 6, fill: "#fde68a" }),
            /* @__PURE__ */ jsx("circle", { cx, cy, r: 14, fill: "#fde68a", opacity: 0.2 }),
            contextLayer,
            edgesLayer,
            highlightLines,
            planetsLayer,
            labelsLayer
          ] })
        }
      ),
      /* @__PURE__ */ jsxs("div", { style: { position: "absolute", top: 8, right: 8, display: "flex", gap: 6, alignItems: "center", background: "rgba(10,14,26,0.7)", padding: "4px 8px", borderRadius: 6, fontSize: 11, color: "#cbd5e1" }, children: [
        /* @__PURE__ */ jsxs("span", { children: [
          zoomPct,
          "%"
        ] }),
        /* @__PURE__ */ jsxs(ui.Button, { size: "xs", color: "ghost", outline: true, onClick: reset, children: [
          /* @__PURE__ */ jsx(Maximize2, { size: 12 }),
          " Reset"
        ] })
      ] })
    ] });
  }
  function CenterPanel() {
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(GraphView, {}) });
  }
  function RightPanel() {
    const { treeId, selectedNid, selectedLexId } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const edges = store.useChildren(treeId || "", "edge");
    const lexicons = store.useChildren(treeId || "", "lexicon");
    const allLexNodes = store.usePosts("lexNode");
    const lexById = useMemo(() => new Map(lexicons.map((l) => [l.id, l])), [lexicons]);
    const nodeByNid = useMemo(() => {
      const m2 = /* @__PURE__ */ new Map();
      for (const n of nodes) m2.set(String(n.data.nodeId), n);
      return m2;
    }, [nodes]);
    if (selectedLexId) {
      const lex = lexById.get(selectedLexId);
      if (!lex) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Termin nie istnieje" });
      const myNidSet = /* @__PURE__ */ new Set();
      for (const ln of allLexNodes) {
        if (ln.parentId === selectedLexId) myNidSet.add(String(ln.data.nid));
      }
      const containingNodes = nodes.filter((n) => myNidSet.has(String(n.data.nodeId)));
      const counter = /* @__PURE__ */ new Map();
      for (const ln of allLexNodes) {
        if (ln.parentId === selectedLexId) continue;
        if (!myNidSet.has(String(ln.data.nid))) continue;
        counter.set(ln.parentId, (counter.get(ln.parentId) || 0) + 1);
      }
      const related = [];
      for (const [lexId, count] of counter) {
        const l = lexById.get(lexId);
        if (l) related.push({ lex: l, count });
      }
      related.sort((a2, b) => b.count - a2.count);
      return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
        /* @__PURE__ */ jsx(
          ui.Heading,
          {
            title: String(lex.data.term),
            subtitle: String(lex.data.category || "termin")
          }
        ),
        /* @__PURE__ */ jsx(ui.Text, { size: "sm", children: String(lex.data.definition || "—") }),
        /* @__PURE__ */ jsx(ui.Divider, {}),
        /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
          "Występuje w (",
          containingNodes.length,
          ")"
        ] }),
        containingNodes.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "brak" }),
        containingNodes.map((n) => /* @__PURE__ */ jsx(
          ui.ListItem,
          {
            label: String(n.data.title),
            detail: String(n.data.branch || ""),
            onClick: () => selectByNid(treeId, String(n.data.nodeId))
          },
          n.id
        )),
        /* @__PURE__ */ jsx(ui.Divider, {}),
        /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
          "Powiązane terminy (",
          related.length,
          ")"
        ] }),
        related.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "brak współwystępujących" }),
        related.map((r) => /* @__PURE__ */ jsx(
          ui.ListItem,
          {
            label: /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 4, background: catColor(String(r.lex.data.category || "")), marginRight: 6 } }),
              String(r.lex.data.term)
            ] }),
            detail: `${r.count} wspólnych węzłów · ${String(r.lex.data.category || "")}`,
            onClick: () => selectByLex(r.lex.id)
          },
          r.lex.id
        ))
      ] }) });
    }
    const node = selectedNid ? nodeByNid.get(selectedNid) : void 0;
    if (!node) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz węzeł lub termin" });
    const myLexs = [];
    for (const ln of allLexNodes) {
      if (String(ln.data.nid) !== selectedNid) continue;
      const l = lexById.get(ln.parentId);
      if (l) myLexs.push(l);
    }
    const lexsByCat = /* @__PURE__ */ new Map();
    for (const l of myLexs) {
      const c2 = String(l.data.category || "inne");
      if (!lexsByCat.has(c2)) lexsByCat.set(c2, []);
      lexsByCat.get(c2).push(l);
    }
    const titleOf = (nid) => {
      var _a;
      return String(((_a = nodeByNid.get(nid)) == null ? void 0 : _a.data.title) ?? nid);
    };
    const out = edges.filter((e) => e.data.fromNid === selectedNid);
    const inc = edges.filter((e) => e.data.toNid === selectedNid);
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: String(node.data.title), subtitle: `#${selectedNid}` }),
      /* @__PURE__ */ jsxs(ui.Row, { children: [
        node.data.branch ? /* @__PURE__ */ jsx(ui.Badge, { children: String(node.data.branch) }) : null,
        node.data.tier ? /* @__PURE__ */ jsxs(ui.Text, { size: "xs", muted: true, children: [
          "Poziom ",
          String(node.data.tier)
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx(ui.Divider, {}),
      /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
        "Terminy (",
        myLexs.length,
        ")"
      ] }),
      myLexs.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "brak" }),
      Array.from(lexsByCat.entries()).map(([cat, ls]) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
        /* @__PURE__ */ jsxs(ui.Row, { children: [
          /* @__PURE__ */ jsx("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 4, background: catColor(cat) } }),
          /* @__PURE__ */ jsxs(ui.Text, { size: "xs", muted: true, children: [
            cat,
            " (",
            ls.length,
            ")"
          ] })
        ] }),
        ls.map((l) => /* @__PURE__ */ jsx(
          ui.ListItem,
          {
            label: String(l.data.term),
            detail: String(l.data.definition || "").slice(0, 60),
            onClick: () => selectByLex(l.id)
          },
          l.id
        ))
      ] }, cat)),
      /* @__PURE__ */ jsx(ui.Divider, {}),
      /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
        "Wychodzące (",
        out.length,
        ")"
      ] }),
      out.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "brak" }),
      out.map((e) => /* @__PURE__ */ jsx(
        ui.ListItem,
        {
          label: titleOf(String(e.data.toNid)),
          detail: e.data.type ? String(e.data.type) : void 0,
          onClick: () => selectByNid(treeId, String(e.data.toNid))
        },
        e.id
      )),
      /* @__PURE__ */ jsx(ui.Divider, {}),
      /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
        "Przychodzące (",
        inc.length,
        ")"
      ] }),
      inc.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "brak" }),
      inc.map((e) => /* @__PURE__ */ jsx(
        ui.ListItem,
        {
          label: titleOf(String(e.data.fromNid)),
          detail: e.data.type ? String(e.data.type) : void 0,
          onClick: () => selectByNid(treeId, String(e.data.fromNid))
        },
        e.id
      ))
    ] }) });
  }
  sdk.registerView("cosmos.left", { slot: "left", component: LeftPanel });
  sdk.registerView("cosmos.center", { slot: "center", component: CenterPanel });
  sdk.registerView("cosmos.right", { slot: "right", component: RightPanel });
  return {
    id: "cosmos-bq",
    label: "Kosmos BQ",
    description: "Kosmiczny widok grafu BQ — orbity gałęzi + księżyce terminów, układ d3-force",
    icon: Share2 || GitBranch,
    version: "0.5.0"
  };
};
export {
  plugin as default
};

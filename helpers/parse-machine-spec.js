/**
 * Module dependencies
 */

var _ = require('lodash');


// Note that this file is designed to be run as a child process.

var machineSpec = '';

process.stdin.setEncoding('utf8');

process.stdin.on('readable', function() {
  var chunk = process.stdin.read();
  if (chunk !== null) {
    machineSpec += chunk;
  }
});

process.stdin.once('end', function() {
  var sandboxedSpec = '(function() {\n';
  _.each(_.keys(global), function(globalKey) {
    // Don't sandbox Proxy
    if (globalKey == 'Proxy') {return;}
    sandboxedSpec += 'var ' + globalKey + '= function(){};\n';
  });
  sandboxedSpec += 'var global = {};\n';
  sandboxedSpec += 'var require = function(){return Proxy.create({get: function(){return function(){return require;}}})}\n';
  sandboxedSpec += machineSpec;
  sandboxedSpec += '\nreturn module.exports;\n';
  sandboxedSpec += '})()\n';
  try {
    var spec = eval(sandboxedSpec);

    // Protect machine's `fn`, exit `getExample()`, and input `validate()` functions.
    if (_.isFunction(spec.fn)) {
      spec.fn = _stringifyFn(spec.fn);
    }
    _.each(spec.inputs||{}, function (inputDef){
      if (_.isFunction(inputDef.validate)) {
        inputDef.validate = _stringifyFn(inputDef.validate);
      }
    });
    _.each(spec.exits||{}, function (exitDef){
      if (_.isFunction(exitDef.getExample)) {
        exitDef.getExample = _stringifyFn(exitDef.getExample);
      }
    });
    process.stdout.write(JSON.stringify(spec));
    process.exit(0);
  }
  catch (e) {
    process.stdout.write(e.stack);
    process.exit(1);
  }
});


/**
 * [_stringifyFn description]
 * @param  {Function} fn [description]
 * @return {[type]}      [description]
 */
function _stringifyFn(fn) {
  var stringifiedFn = fn.toString();
  stringifiedFn = stringifiedFn.replace(/^([\W]*?function\s*\(.*?\).*?\{[\W*])([\w\W]*)\}$/, "$2");
  stringifiedFn = stringifiedFn.replace(/^\t\t/mg, '');
  return stringifiedFn;
}

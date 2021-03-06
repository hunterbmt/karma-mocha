var formatError = function (error) {
  var stack = error.stack
  var message = error.message

  if (stack) {
    if (message && stack.indexOf(message) === -1) {
      stack = message + '\n' + stack
    }

    // remove mocha stack entries
    return stack.replace(/\n.+\/mocha\/mocha.js\?\w*:.+(?=(\n|$))/g, '')
  }

  return message
}

var processAssertionError = function (error_) {
  var error

  if (window.Mocha && error_.hasOwnProperty('showDiff')) {
    error = {
      name: error_.name,
      message: error_.message,
      showDiff: error_.showDiff
    }

    if (error.showDiff) {
      error.actual = window.Mocha.utils.stringify(error_.actual)
      error.expected = window.Mocha.utils.stringify(error_.expected)
    }
  }

  return error
}

// non-compliant version of Array::reduce.call (requires memo argument)
var arrayReduce = function (array, reducer, memo) {
  for (var i = 0, len = array.length; i < len; i++) {
    memo = reducer(memo, array[i])
  }
  return memo
}

var createMochaReporterNode = function () {
  var mochaRunnerNode = document.createElement('div')
  mochaRunnerNode.setAttribute('id', 'mocha')
  document.body.appendChild(mochaRunnerNode)
}

var haveMochaConfig = function (karma) {
  return karma.config && karma.config.mocha
}

var createMochaReporterConstructor = function (tc, pathname) {
  var isDebugPage = /debug.html$/.test(pathname)

  // Set custom reporter on debug page
  if (isDebugPage && haveMochaConfig(tc) && tc.config.mocha.reporter) {
    createMochaReporterNode()
    return tc.config.mocha.reporter
  }

  // TODO(vojta): error formatting
  return function (runner) {
    // runner events
    // - start
    // - end
    // - suite
    // - suite end
    // - test
    // - test end
    // - pass
    // - fail
    // - pending

    runner.on('start', function () {
      tc.info({total: runner.total})
    })

    runner.on('end', function () {
      tc.complete({
        coverage: window.__coverage__
      })
    })

    runner.on('test', function (test) {
      test.$errors = []
      test.$assertionErrors = []
    })

    runner.on('pending', function (test) {
      test.pending = true
    })

    runner.on('fail', function (test, error) {
      var simpleError = formatError(error)
      var assertionError = processAssertionError(error)

      if (test.type === 'hook') {
        test.$errors = isDebugPage ? [error] : [simpleError]
        test.$assertionErrors = assertionError ? [assertionError] : []
        runner.emit('test end', test)
      } else {
        test.$errors.push(isDebugPage ? error : simpleError)
        if (assertionError) test.$assertionErrors.push(assertionError)
      }
    })

    runner.on('test end', function (test) {
      var skipped = test.pending === true

      var result = {
        id: '',
        description: test.title,
        suite: [],
        success: test.state === 'passed',
        skipped: skipped,
        time: skipped ? 0 : test.duration,
        log: test.$errors || [],
        assertionErrors: test.$assertionErrors || [],
        test: test
      }

      var pointer = test.parent
      while (!pointer.root) {
        result.suite.unshift(pointer.title)
        pointer = pointer.parent
      }

      tc.result(result)
    })
  }
}
/* eslint-disable no-unused-vars */
var createMochaStartFn = function (mocha) {
  /* eslint-enable no-unused-vars */
  return function (config) {
    var clientArguments
    config = config || {}
    clientArguments = config.args

    if (clientArguments) {
      if (Object.prototype.toString.call(clientArguments) === '[object Array]') {
        arrayReduce(clientArguments, function (isGrepArg, arg) {
          if (isGrepArg) {
            mocha.grep(new RegExp(arg))
          } else if (arg === '--grep') {
            return true
          } else {
            var match = /--grep=(.*)/.exec(arg)

            if (match) {
              mocha.grep(new RegExp(match[1]))
            }
          }
          return false
        }, false)
      }

      /**
       * TODO(maksimrv): remove when karma-grunt plugin will pass
       * clientArguments how Array
       */
      if (clientArguments.grep) {
        mocha.grep(clientArguments.grep)
      }
    }

    mocha.run()
  }
}

// Default configuration
var mochaConfig = {
  reporter: createMochaReporterConstructor(window.__karma__, window.location.pathname),
  ui: 'bdd',
  globals: ['__cov*']
}

// Pass options from client.mocha to mocha
/* eslint-disable no-unused-vars */
var createConfigObject = function (karma) {
  /* eslint-enable no-unused-vars */

  if (!karma.config || !karma.config.mocha) {
    return mochaConfig
  }

  // Copy all properties to mochaConfig
  for (var key in karma.config.mocha) {
    // except for reporter
    if (key === 'reporter') {
      continue
    }

    // and merge the globals if they exist.
    if (key === 'globals') {
      mochaConfig.globals = mochaConfig.globals.concat(karma.config.mocha[key])
      continue
    }

    mochaConfig[key] = karma.config.mocha[key]
  }
  return mochaConfig
}

const RPClient = require('reportportal-client');
const fs = require('fs');
const path = require('path');
const debug = require('debug')('codeceptjs:reportportal');
const { event, recorder, output, container } = codeceptjs;

const helpers = container.helpers();
let helper;

const rp_FAILED = 'FAILED';
const rp_PASSED = 'PASSED';
const rp_SUITE = 'SUITE';
const rp_TEST = 'TEST';
const rp_STEP = 'STEP';

const screenshotHelpers = [
  'WebDriver',
  'Protractor',
  'Appium',
  'Nightmare',
  'Puppeteer',
  'TestCafe',
  'Playwright',
];

for (const helperName of screenshotHelpers) {
  if (Object.keys(helpers).indexOf(helperName) > -1) {
    helper = helpers[helperName];
  }
}

const defaultConfig = {
  token: '',
  endpoint: '',
  project: '',
  launchDescription: '',
  attributes: [],
  debug: false,
  rerun: undefined,
  enabled: false
};

module.exports = (config) => {
  config = Object.assign(defaultConfig, config);

  let launchObj;
  let suiteObj;
  let testObj;
  let failedStep;
  let rpClient;

  let suiteStatus = rp_PASSED;
  let launchStatus = rp_PASSED;
  let currentMetaSteps = [];


  event.dispatcher.on(event.all.before, () => {
    launchObj = startLaunch();
    launchObj.promise.catch(err => {
      output.error('Can`\t connect to ReportPortal');
      output.error(err);
    });
    output.print('Logging results to ReportPortal');
    debug(`${launchObj.tempId}: The launchId is started.`);
  });

  event.dispatcher.on(event.suite.before, (suite) => {
    recorder.add(async () => {
      suiteObj = startTestItem(suite.title, rp_SUITE);
      debug(`${suiteObj.tempId}: The suiteId '${suite.title}' is started.`);
      suite.tempId = suiteObj.tempId;
      suiteStatus = rp_PASSED;
    });
  });

  event.dispatcher.on(event.test.before, (test) => {
    recorder.add(async () => {
      currentMetaSteps = [];
      stepObj = null;
      testObj = startTestItem(test.title, rp_TEST, suiteObj.tempId);
      test.tempId = testObj.tempId;
      failedStep = null;
      debug(`${testObj.tempId}: The testId '${test.title}' is started.`);
    })
  });

  event.dispatcher.on(event.step.before, (step) => {
    recorder.add(async () => {      
      const parent = await startMetaSteps(step);
      stepObj = startTestItem(step.toString(), rp_STEP, parent.tempId);
      step.tempId = stepObj.tempId;
    })
  });

  event.dispatcher.on(event.step.after, (step) => {
    recorder.add(() => finishStep(step));
  });

  event.dispatcher.on(event.step.failed, (step) => {
    for (const metaStep of currentMetaSteps) {
      if (metaStep) metaStep.status = 'failed';
    }
    if (step && step.tempId) failedStep = step;
  });

  event.dispatcher.on(event.step.passed, (step, err) => {
    for (const metaStep of currentMetaSteps) {
      metaStep.status = 'passed';
    }
    failedStep = null;
  });

  event.dispatcher.on(event.test.failed, async (test, err) => {
    launchStatus = rp_FAILED;
    suiteStatus = rp_FAILED;

    if (failedStep && failedStep.tempId) {
      const step = failedStep;

      debug(`Attaching screenshot & error to failed step`);
  
      const screenshot = await attachScreenshot();

      await rpClient.sendLog(step.tempId, {
        level: 'error',
        message: `${err.stack}`,
        time: step.startTime,
      }, screenshot).promise; 
    }

    debug(`${test.tempId}: Test '${test.title}' failed.`);
    rpClient.finishTestItem(test.tempId, {
      endTime: test.endTime || rpClient.helpers.now(),
      status: rp_FAILED,
    });  
  });

  event.dispatcher.on(event.test.passed, (test, err) => {
    debug(`${test.tempId}: Test '${test.title}' passed.`);
    rpClient.finishTestItem(test.tempId, {
      endTime: test.endTime || rpClient.helpers.now(),
      status: rp_PASSED,
    });    
  });

  event.dispatcher.on(event.test.after, (test) => {
    recorder.add(async () => {
      debug(`closing ${currentMetaSteps.length} metasteps for failed test`);
      if (failedStep) await finishStep(failedStep);
      await Promise.all(currentMetaSteps.reverse().map(m => finishStep(m)));
    });
  });

  event.dispatcher.on(event.suite.after, (suite) => {
    recorder.add(async () => {
      debug(`${suite.tempId}: Suite '${suite.title}' finished ${suiteStatus}.`);
      return rpClient.finishTestItem(suite.tempId, {
        endTime: suite.endTime || rpClient.helpers.now(),
        status: rpStatus(suiteStatus)
      });
    });
  });

  function startTestItem(testTitle, method, parentId = null) {
    try {
      const hasStats = method !== rp_STEP;
      return rpClient.startTestItem({
        name: testTitle,
        type: method,
        hasStats,
      }, launchObj.tempId, parentId);
    } catch (error) {
      output.err(error);
    }

  }

  event.dispatcher.on(event.all.result, () => {
    recorder.add(async () => {
      // await suiteObj.promise;
      await rpClient.finishTestItem(suiteObj.tempId, {
        status: suiteStatus,
      }).promise;
      finishLaunch();
    });
  });

  function startLaunch(suiteTitle) {
    rpClient = new RPClient({
      token: config.token,
      endpoint: config.endpoint,
      project: config.projectName,
      debug: config.debug,
    });

    return rpClient.startLaunch({
      name: config.launchName || suiteTitle,
      description: config.launchDescription,
      attributes: config.launchAttributes,
      rerun: config.rerun,
      rerunOf: config.rerunOf,
    });
  }

  async function attachScreenshot() {
    if (!helper) return undefined;
    
    const fileName = `${rpClient.helpers.now()}_failed.png`;
    try {
      await helper.saveScreenshot(fileName);
    } catch (err) {
      output.error(`Couldn't save screenshot`);
      return undefined;
    }

    const content = fs.readFileSync(path.join(global.output_dir, fileName));
    fs.unlinkSync(path.join(global.output_dir, fileName));

    return {
      name: fileName,
      type: 'image/png',
      content,
    }
  }

  function finishLaunch() {
    try {
      debug(`${launchObj.tempId} Finished launch: ${launchStatus}`)
      return rpClient.finishLaunch(launchObj.tempId, {
        status: launchStatus,
      });
    } catch (error) {
      debug(error);
    }
  }

  async function startMetaSteps(step) {
    let metaStepObj = {};
    const metaSteps = metaStepsToArray(step.metaStep);

    for (const i in metaSteps) {
      const metaStep = metaSteps[i];
      if (isEqualMetaStep(metaStep, currentMetaSteps[i])) {
        continue;
      } 
      // close current metasteps
      for (let j = i; j < currentMetaSteps.length; j++) {
        await finishStep(currentMetaSteps[j]);
        delete currentMetaSteps[j];
      }

      metaStepObj = currentMetaSteps[currentMetaSteps.length - 1] || {};

      const isNested = !!metaStepObj.tempId;
      metaStepObj = startTestItem(metaStep.toString(), rp_STEP, metaStepObj.tempId || testObj.tempId);
      metaStep.tempId = metaStepObj.tempId;
      debug(`${metaStep.tempId}: The stepId '${metaStep.toString()}' is started. Nested: ${isNested}`);
    }

    currentMetaSteps = metaSteps;
    return currentMetaSteps[currentMetaSteps.length - 1] || testObj;
  }

  function finishStep(step) {
    if (!step) return;

    debug(`Finishing '${step.toString()}' step`);

    return rpClient.finishTestItem(step.tempId, {
      endTime: rpClient.helpers.now(),
      status: rpStatus(step.status),
    });
  }


  return this;
};

function metaStepsToArray(step) {
  let metaSteps = [];
  iterateMetaSteps(step, metaStep => metaSteps.push(metaStep));
  return metaSteps;
}

function iterateMetaSteps(step, fn) {
  if (step.metaStep) iterateMetaSteps(step.metaStep, fn);
  if (step) fn(step);
}


const isEqualMetaStep = (metastep1, metastep2) => {
  if (!metastep1 && !metastep2) return true;
  if (!metastep1 || !metastep2) return false;
  return metastep1.actor === metastep2.actor 
    && metastep1.name === metastep2.name 
    && metastep1.args.join(',') === metastep2.args.join(',');
};


function rpStatus(status) {
  if (status === 'success') return rp_PASSED;
  if (status === 'failed') return rp_FAILED;
  return status;
}


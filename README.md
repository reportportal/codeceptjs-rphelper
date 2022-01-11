# ReportPortal Agent for CodeceptJS

📋Beautiful enterprise-grade test reports integrated with [CodeceptJS](https://codecept.io) testing framework.
This helpes you integrate the test results of CodeceptJS with ReportPortal

> Based on [CodeceptJS RPHelper by PeterNgTr](https://github.com/PeterNgTr/codeceptjs-rphelper).

![ReportPortal Test](https://i.ibb.co/Qm52G0n/Screenshot-2019-04-11-at-15-57-40.png)

`@reportportal/agent-js-codecept` is a [CodeceptJS](https://codecept.io/) plugin which can publish tests results on [ReportPortal](https://reportportal.io/) after execution.

When enabled this plugin sends information on test runs to ReportPortal server:

* ✅status for failed and passed tests
* 🔍step by step log
* 🖼screenshots on failure are attached

## Installation

```sh
npm i @reportportal/agent-js-codecept --save
```

## Configuration

This plugin should be added in `codecept.conf.js`

Example:

```js
{
  //...
   plugins: {
    reportportal: {
      enabled: true,
      require: '@reportportal/agent-js-codecept',
      token: 'YOUR_TOKEN',
      endpoint: 'http://localhost:8080/api/v1',
      launchName: 'local launch',
      selenoidVideoUpload: true,
      selenoidVideoPath: './output/video'
    }
  //...
}
```

To use this plugin you need to provide the following info:

* `token`: which can be found by navigating to the user profile page, clicking the username drop-down in the right header and selecting the "Profile" > "UUID" – is a unique user identifier. UUID is used in automated test configuration files for a user authentication instead of a password. It will allow you to post data, without logging it in the UI.
* `endpoint`: your reportportal host + `api/v1` for instance: `http://localhost:8080/api/v1`
* `launchName`: the launch name you want, if not provided, the suite title will be used
* `projectName`: the project that you created in the reportportal UI
* `launchDescription`: (optional) the description of your launch, if not provided, the description will be empty
* `launchAttributes`: (optional) the attributes of your launch, if not provided, the attributes will be empty
* `debug`: (optional) to turn on the debug for reportportal
* `rerun`: (optional) to enable [rerun](https://github.com/reportportal/documentation/blob/master/src/md/src/DevGuides/rerun.md)
* `rerunOf`: (optional) UUID of launch you want to rerun. If not specified, report portal will update the latest launch with the same name.
* `selenoidVideoUpload`: (optional) Indicates if selenoid video should be uploaded on failed tests. Default: false
* `selenoidVideoPath`: (optional) Specifies where the selenoid videos are located. Default: `./output/video`

### Selenoid Video Upload Feature

#### Codeceptjs configuration

To use the selenoid video upload feature you have to add the special capability `videoName` with a random id if you run your tests in parallel. The feature needs a per test identifier for the video. [Selenoid Special Capability](https://aerokube.com/selenoid/latest/#_video_recording_enablevideo_videoname_videoscreensize_videoframerate_videocodec)

You have also to set the special capability `enableVideo` to `true`.

Example:

```javascript
'selenoid:options': {
            enableVideo: true, // Enable video for selenoid
            videoName: `${uuidv4()}.mp4`, // Set video name with per test identifier if tests are run in parallel. 
        },
```

#### Reporter configuration

Set `selenoidVideoUpload` and `selenoidVideoPath` in the reportportal agent configuration.

## Public API

### Add Log Message

You can send logs to ReportPortal to current step / test by accessing this plugin from your code:

```js
const reportPortal = codeceptjs.container.plugins('reportportal');
reportPortal.addLog({
  level: 'debug',
  message: 'your message'
});
```

To send attachment, use second parameter:

```js
const reportPortal = codeceptjs.container.plugins('reportportal');
reportPortal.addLog({
  level: 'debug',
  message: 'your message'
}, {
  name: 'screenshot.png',
  type: 'image/png',
  content: fs.readFileSync('output/screenshot.png')
});
```

See [`sendLog` method of ReportPortal JavaScript Client](https://github.com/reportportal/client-javascript#sendlog) for more oprtions.

### Get Report URL

Once report is posted a special `reportportal.result` event is created.

You can use it to pass URL of a report into other plugins. For instance, you can use it to send Slack or Email notifications including a link to a report.

```js
// inside your custom plugin:
event.dispatcher.on('reportportal.result', (result) => {
  // use result.link as URL to report
  console.log('Report was published at', result.link);
})
```

## Todo

* [x] Support `run-workers` command to aggregate all tests under one launch.

## Debugging Plugin

To debug this plugin run script enabing DEBUG env variable:

``` bash
DEBUG="codeceptjs:reportportal"  npx codeceptjs run
```

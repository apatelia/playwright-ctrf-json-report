# Playwright JSON Reporter - CTRF

playwright-ctrf-json-reporter is a Playwright test reporter to generate JSON test reports that are [CTRF](https://ctrf.io) compliant.

With [Common Test Report Format](https://ctrf.io) you can generate the same JSON report no matter which no matter which framework or library you use.

## Features

- Generate JSON test reports that are [CTRF](https://ctrf.io) compliant
- Customizable output options, minimal or comprehensive reports
- Straightforward integration with Playwright
- Enhanced test insights with detailed test information, environment details, and more.

## What is CTRF?

A JSON test report that is the same structure, no matter which testing tool is used. It's created to provide consistent test reporting across multiple testing libraries and frameworks. Many testing libraries exist, each generating test reports in their own way, CTRF provides a standardised JSON report schema for all so you can generate the same report anywhere.

## Installation

```bash
npm install --save-dev playwright-ctrf-json-reporter
```

Add the reporter to your playwright.config.ts file:

```javascript
  reporter: [
    ['list'], // You can combine multiple reporters
    ['playwright-ctrf-json-reporter', {}]
  ],
```

Run your tests:

```bash
npx playwright test
```

You'll find a JSON file named `ctrf-report.json` in the root of your project.

## Reporter Options

The reporter supports several configuration options:

```javascript
reporter: [
    ['playwright-ctrf-json-reporter', {
        outputFile: 'custom-name.json', // Optional: Output file name. Defaults to 'ctrf-report.json'.
        outputDir: 'custom-directory',  // Optional: Output directory path. Defaults to '.' (project root).
        minimal: true,                  // Optional: Generate a minimal report. Defaults to 'false'. Overrides screenshot and testType
        screenshot: false,               // Optional: Include screenshots in the report. Defaults to 'false'.
        testType: 'e2e',                // Optional: Specify the test type (e.g., 'unit', 'e2e'). Defaults to 'e2e'.
        appName: 'MyApp',               // Optional: Specify the name of the application under test.
        appVersion: '1.0.0',            // Optional: Specify the version of the application under test.
        osPlatform: 'linux',            // Optional: Specify the OS platform.
        osRelease: '18.04',             // Optional: Specify the OS release version.
        osVersion: '5.4.0',             // Optional: Specify the OS version.
        buildName: 'MyApp Build',       // Optional: Specify the build name.
        buildNumber: '100',             // Optional: Specify the build number.
    }]
  ],
```

By default, a comprehensive report is generated, with the exception of screenshots, which you must explicitly set to true.

## CTRF types supported

| Name         | Default                   | Description                                                                                                                          |
| ------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `outputFile` | `'ctrf-report.json'`      | The name of the test reportfile.                                                                                                     |
| `outputDir`  | `'.'` (current directory) | Directory where the report file will be generated.                                                                                   |
| `minimal`    | `false`                   | Minimal report with only required CTRF properties, [more information](https://ctrf.io/docs/schema/examples#required-properties-only) |
| `start`      | `true`                    | Include the start time of each test                                                                                                  |
| `stop`       | `true`                    | Include the stop/end time of each test                                                                                               |
| `suite`      | `true`                    | Include the suite name with each test                                                                                                |
| `message`    | `true`                    | Include failure message for failed tests.                                                                                            |
| `trace`      | `true`                    | Include stack trace information for failed tests.                                                                                    |
| `rawStatus`  | `true`                    | Include the Playwright status of each test.                                                                                          |
| `tags`       | `true`                    | Includes tags with each test.                                                                                                        |
| `type`       | `true`                    | Include the type of test (e.g., 'unit', 'e2e').                                                                                      |
| `filePath`   | `true`                    | Include the file path of each test                                                                                                   |
| `retry`      | `true`                    | Include retry count of each test if retries occurred.                                                                                |
| `flake`      | `true`                    | Include flake status with each test                                                                                                  |
| `browser`    | `false`                   | Include the browser used for the test (if applicable).                                                                               |
| `screenshot` | `false`                   | Include screenshot of each test (if applicable)                                                                                      |
| `customType` | `'e2e'`                   | Specify a custom type for the tests.                                                                                                 |

## Advanced usage

Some features require additional setup or usage considerations.

### Screenshots

You can include base-64 screenshots in your test report, you'll need to capture and attach screenshots in your Playwright tests:

```javascript
import { test, expect } from '@playwright/test'

test('basic test', async ({ page }, testInfo) => {
  await page.goto('https://playwright.dev')
  const screenshot = await page.screenshot({ quality: 50, type: 'jpeg' })
  await testInfo.attach('screenshot', {
    body: screenshot,
    contentType: 'image/jpeg',
  })
})
```

#### Supported Formats

Both JPEG and PNG formats are supported, only the last screenshot attached from each test will be included in the report.

#### Size Considerations

Base64-encoded image data can greatly increase the size of your report, it's recommended to use screenshots with a lower quality setting (less than 50%) to reduce file size, particularly if you are generating JPEG images.

### Browser

You can include browser information in your test report. You will need to extend Playwright's test object to capture and attach browser metadata for each test:

```javascript
// tests/helpers.ts
import { test as _test, expect } from '@playwright/test';
import os from 'os';

export const test = _test.extend<{ _autoAttachMetadata: void }>({
    _autoAttachMetadata: [async ({ browser, browserName }, use, testInfo) => {
        // BEFORE: Generate an attachment for the test with the required info
        await testInfo.attach('metadata.json', {
            body: JSON.stringify({
                name: browserName,
                version: browser.version(),
            })
        })

        // ---------------------------------------------------------
        await use(/** our test doesn't need this fixture direcly */);
        // ---------------------------------------------------------

        // AFTER: There's nothing to cleanup in this fixutre
    }, { auto: true }],
})

export { expect };
```

Replace the standard Playwright test import with the custom test fixture in your test files:

```javascript
// tests/my-test.spec.ts
import { test, expect } from './helpers' // Adjust the path as necessary

test('example test', async ({ page }) => {
  // ... your test logic ...
})
```

The browser metadata file must be called metadata.json and contain properties name and version in the body.

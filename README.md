# Update Main Args (Brighterscript Plugin)

A [Brighterscript](https://github.com/rokucommunity/brighterscript) plugin that injects properties into the argument of the main function - useful for adding [deep links](https://developer.roku.com/en-ca/docs/developer-program/discovery/implementing-deep-linking.md) for debugging, for example.

## Usage

In a Brighterscript project, install the plugin:

```sh
npm install -D bsc-plugin-update-main-args
```

Add it to the plugins list in `bsconfig.json`, and set up the arguments to load:

```json
{
    "plugins": ["bsc-plugin-update-main-args"],
    "updateMainArgs": {
        "args": {
            "mediaType": "movie",
            "contentId": "test-1234"
        }
    }
}
```

## Read Args from .env

This plugin can also read arguments from an `.env` file (or from your system's environment variables).

Create a `.env` file with the variable `MAIN_ARGS`. It should be in JSON format:

```env
MAIN_ARGS={"mediaType":"movie","contentId":"test-1234"}
```

Change the `bsconfig` options to load the environment variable:

```json
{
    "plugins": ["bsc-plugin-update-main-args"],
    "updateMainArgs": {
        "useEnv": true,
        "envFilePath": ".env"
    }
}
```

## Full Configuration Options

```jsonc
{
    "updateMainArgs": {
        "useEnv": true, // read environment variable
        "envFilePath": ".env", // path to specific .env file to read
        "envVar": "MAIN_ARGS", // The environment variable to read
        "args": {} // Just add args directly
    }
}
```

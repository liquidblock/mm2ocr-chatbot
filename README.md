# mm2ocr-chatbot
Twitch chatbot to be used with https://github.com/dram55/MarioMaker2OCR/

## Configuration & Installation

1) Install and setup Mario Maker 2 OCR:
https://github.com/dram55/MarioMaker2OCR/

2) Setup a `node` and `npm` environment

3) Install the following npm packages in this folder:
    ```
    npm install ws reconnecting-websocket tmi.js @js-joda/core
    ```

4) Setup a twitch bot account, or use your own twitch account

5) Create an oauth-token for your bot account: https://twitchapps.com/tmi/

6) Set the following settings in `settings.json`:

    * `name`: set this to your bots username (lowercase)
    * `token`: set this to the oauth-token created in step `(5)`, including the `oauth:` part
    * `channel`: set this to your twitch channel (lowercase)

## Start

Run in this folder:
```
node --experimental-modules index.mjs
```

## License

Licensed under either of

 * Apache License, Version 2.0
   ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
 * MIT license
   ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

## Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.

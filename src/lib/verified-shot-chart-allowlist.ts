// Server-only integrity allowlist. These are three independently reviewed games,
// never a generic source-ingestion path. Period FG + official FT = reported points.
// UTC tipoff is pinned independently of the local date in gameCode.
export const reviewedShotGames = {
  "0022500961": {
    "gameId": "0022500961",
    "gameCode": "20260313/MEMDET",
    "gameTimeUTC": "2026-03-13T23:30:00Z",
    "factsSha256": "00dbdba6cd68f72513fe80dcdbd44c1b7588bf9c1df14d38bd4a66fd65aadaff",
    "source": {
      "label": "NBA official game charts",
      "url": "https://www.nba.com/game/mem-vs-det-0022500961/game-charts",
      "retrievedAt": "2026-10-03T05:08:18.649Z"
    },
    "home": {
      "teamId": 1610612765,
      "teamTricode": "DET",
      "score": 126,
      "shooting": [
        50,
        92,
        12,
        35
      ],
      "freeThrowsMade": 14,
      "periods": [
        {
          "shooting": [
            16,
            24,
            5,
            11
          ],
          "freeThrowsMade": 0,
          "points": 37
        },
        {
          "shooting": [
            13,
            22,
            3,
            9
          ],
          "freeThrowsMade": 2,
          "points": 31
        },
        {
          "shooting": [
            11,
            22,
            3,
            8
          ],
          "freeThrowsMade": 5,
          "points": 30
        },
        {
          "shooting": [
            10,
            24,
            1,
            7
          ],
          "freeThrowsMade": 7,
          "points": 28
        }
      ]
    },
    "away": {
      "teamId": 1610612763,
      "teamTricode": "MEM",
      "score": 110,
      "shooting": [
        38,
        89,
        15,
        41
      ],
      "freeThrowsMade": 19,
      "periods": [
        {
          "shooting": [
            12,
            22,
            6,
            9
          ],
          "freeThrowsMade": 5,
          "points": 35
        },
        {
          "shooting": [
            9,
            23,
            3,
            11
          ],
          "freeThrowsMade": 5,
          "points": 26
        },
        {
          "shooting": [
            9,
            21,
            2,
            10
          ],
          "freeThrowsMade": 3,
          "points": 23
        },
        {
          "shooting": [
            8,
            23,
            4,
            11
          ],
          "freeThrowsMade": 6,
          "points": 26
        }
      ]
    }
  },
  "0042500405": {
    "gameId": "0042500405",
    "gameCode": "20260613/NYKSAS",
    "gameTimeUTC": "2026-06-14T00:30:00Z",
    "factsSha256": "72cbc0a0c3daef17ef387ca9b990b6c6525d8895427669b29b893684bb378caf",
    "source": {
      "label": "NBA official game charts",
      "url": "https://www.nba.com/game/nyk-vs-sas-0042500405/game-charts",
      "retrievedAt": "2026-10-03T06:22:28.352889+00:00"
    },
    "home": {
      "teamId": 1610612759,
      "teamTricode": "SAS",
      "score": 90,
      "shooting": [
        33,
        86,
        12,
        37
      ],
      "freeThrowsMade": 12,
      "periods": [
        {
          "shooting": [
            9,
            21,
            3,
            11
          ],
          "freeThrowsMade": 2,
          "points": 23
        },
        {
          "shooting": [
            6,
            23,
            3,
            10
          ],
          "freeThrowsMade": 4,
          "points": 19
        },
        {
          "shooting": [
            11,
            20,
            4,
            10
          ],
          "freeThrowsMade": 4,
          "points": 30
        },
        {
          "shooting": [
            7,
            22,
            2,
            6
          ],
          "freeThrowsMade": 2,
          "points": 18
        }
      ]
    },
    "away": {
      "teamId": 1610612752,
      "teamTricode": "NYK",
      "score": 94,
      "shooting": [
        31,
        87,
        12,
        37
      ],
      "freeThrowsMade": 20,
      "periods": [
        {
          "shooting": [
            4,
            22,
            3,
            9
          ],
          "freeThrowsMade": 2,
          "points": 13
        },
        {
          "shooting": [
            9,
            22,
            4,
            10
          ],
          "freeThrowsMade": 2,
          "points": 24
        },
        {
          "shooting": [
            10,
            26,
            3,
            12
          ],
          "freeThrowsMade": 5,
          "points": 28
        },
        {
          "shooting": [
            8,
            17,
            2,
            6
          ],
          "freeThrowsMade": 11,
          "points": 29
        }
      ]
    }
  },
  "0042500173": {
    "gameId": "0042500173",
    "gameCode": "20260424/LALHOU",
    "gameTimeUTC": "2026-04-25T00:00:00Z",
    "factsSha256": "f2da580cff5b72098d2ddcddb64549f01cb38677dcc01ba9833c1b60c24f0b9e",
    "source": {
      "label": "NBA official game charts",
      "url": "https://www.nba.com/game/lal-vs-hou-0042500173/game-charts",
      "retrievedAt": "2026-10-03T06:22:32.965745+00:00"
    },
    "home": {
      "teamId": 1610612745,
      "teamTricode": "HOU",
      "score": 108,
      "shooting": [
        40,
        98,
        11,
        39
      ],
      "freeThrowsMade": 17,
      "periods": [
        {
          "shooting": [
            11,
            25,
            4,
            11
          ],
          "freeThrowsMade": 6,
          "points": 32
        },
        {
          "shooting": [
            5,
            18,
            3,
            8
          ],
          "freeThrowsMade": 7,
          "points": 20
        },
        {
          "shooting": [
            10,
            23,
            0,
            9
          ],
          "freeThrowsMade": 3,
          "points": 23
        },
        {
          "shooting": [
            11,
            22,
            3,
            6
          ],
          "freeThrowsMade": 1,
          "points": 26
        },
        {
          "shooting": [
            3,
            10,
            1,
            5
          ],
          "freeThrowsMade": 0,
          "points": 7
        }
      ]
    },
    "away": {
      "teamId": 1610612747,
      "teamTricode": "LAL",
      "score": 112,
      "shooting": [
        38,
        79,
        12,
        29
      ],
      "freeThrowsMade": 24,
      "periods": [
        {
          "shooting": [
            14,
            22,
            6,
            9
          ],
          "freeThrowsMade": 5,
          "points": 39
        },
        {
          "shooting": [
            9,
            18,
            2,
            4
          ],
          "freeThrowsMade": 4,
          "points": 24
        },
        {
          "shooting": [
            6,
            16,
            2,
            7
          ],
          "freeThrowsMade": 3,
          "points": 17
        },
        {
          "shooting": [
            7,
            18,
            1,
            6
          ],
          "freeThrowsMade": 6,
          "points": 21
        },
        {
          "shooting": [
            2,
            5,
            1,
            3
          ],
          "freeThrowsMade": 6,
          "points": 11
        }
      ]
    }
  }
} as const;

// Server-only integrity allowlist. These are seven independently reviewed games,
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
  },
  "0042500401": {
    "gameId": "0042500401",
    "gameCode": "20260603/NYKSAS",
    "gameTimeUTC": "2026-06-04T00:30:00Z",
    "factsSha256": "4ece01b5809c90340c0e2262edf495f8735d86736b74355fc916a8a94320fdc9",
    "source": {
      "label": "NBA official game charts",
      "url": "https://www.nba.com/game/nyk-vs-sas-0042500401/game-charts",
      "retrievedAt": "2026-10-03T07:37:53.735101+00:00"
    },
    "home": {
      "teamId": 1610612759,
      "teamTricode": "SAS",
      "score": 95,
      "shooting": [
        32,
        89,
        11,
        43
      ],
      "freeThrowsMade": 20,
      "periods": [
        {
          "shooting": [
            9,
            24,
            4,
            12
          ],
          "freeThrowsMade": 5,
          "points": 27
        },
        {
          "shooting": [
            9,
            21,
            5,
            12
          ],
          "freeThrowsMade": 5,
          "points": 28
        },
        {
          "shooting": [
            8,
            23,
            0,
            9
          ],
          "freeThrowsMade": 5,
          "points": 21
        },
        {
          "shooting": [
            6,
            21,
            2,
            10
          ],
          "freeThrowsMade": 5,
          "points": 19
        }
      ]
    },
    "away": {
      "teamId": 1610612752,
      "teamTricode": "NYK",
      "score": 105,
      "shooting": [
        39,
        94,
        11,
        36
      ],
      "freeThrowsMade": 16,
      "periods": [
        {
          "shooting": [
            8,
            24,
            3,
            11
          ],
          "freeThrowsMade": 0,
          "points": 19
        },
        {
          "shooting": [
            12,
            25,
            3,
            9
          ],
          "freeThrowsMade": 2,
          "points": 29
        },
        {
          "shooting": [
            10,
            23,
            2,
            10
          ],
          "freeThrowsMade": 6,
          "points": 28
        },
        {
          "shooting": [
            9,
            22,
            3,
            6
          ],
          "freeThrowsMade": 8,
          "points": 29
        }
      ]
    }
  },
  "0042500402": {
    "gameId": "0042500402",
    "gameCode": "20260605/NYKSAS",
    "gameTimeUTC": "2026-06-06T00:30:00Z",
    "factsSha256": "119a9d1b66e5766f0588d1b057956480b01c9f053d90f031be7327334399b0e2",
    "source": {
      "label": "NBA official game charts",
      "url": "https://www.nba.com/game/nyk-vs-sas-0042500402/game-charts",
      "retrievedAt": "2026-10-03T07:38:00.990946+00:00"
    },
    "home": {
      "teamId": 1610612759,
      "teamTricode": "SAS",
      "score": 104,
      "shooting": [
        37,
        78,
        11,
        29
      ],
      "freeThrowsMade": 19,
      "periods": [
        {
          "shooting": [
            13,
            20,
            4,
            8
          ],
          "freeThrowsMade": 4,
          "points": 34
        },
        {
          "shooting": [
            4,
            21,
            2,
            10
          ],
          "freeThrowsMade": 8,
          "points": 18
        },
        {
          "shooting": [
            9,
            19,
            2,
            7
          ],
          "freeThrowsMade": 3,
          "points": 23
        },
        {
          "shooting": [
            11,
            18,
            3,
            4
          ],
          "freeThrowsMade": 4,
          "points": 29
        }
      ]
    },
    "away": {
      "teamId": 1610612752,
      "teamTricode": "NYK",
      "score": 105,
      "shooting": [
        37,
        89,
        15,
        38
      ],
      "freeThrowsMade": 16,
      "periods": [
        {
          "shooting": [
            8,
            21,
            3,
            7
          ],
          "freeThrowsMade": 6,
          "points": 25
        },
        {
          "shooting": [
            10,
            21,
            5,
            13
          ],
          "freeThrowsMade": 6,
          "points": 31
        },
        {
          "shooting": [
            12,
            22,
            4,
            7
          ],
          "freeThrowsMade": 0,
          "points": 28
        },
        {
          "shooting": [
            7,
            25,
            3,
            11
          ],
          "freeThrowsMade": 4,
          "points": 21
        }
      ]
    }
  },
  "0042500403": {
    "gameId": "0042500403",
    "gameCode": "20260608/SASNYK",
    "gameTimeUTC": "2026-06-09T00:30:00Z",
    "factsSha256": "b671c2a22800b7b7535cb5b1a4b794ab473ad8924db5070236e78cfd0422a63f",
    "source": {
      "label": "NBA official game charts",
      "url": "https://www.nba.com/game/sas-vs-nyk-0042500403/game-charts",
      "retrievedAt": "2026-10-03T07:38:09.681788+00:00"
    },
    "home": {
      "teamId": 1610612752,
      "teamTricode": "NYK",
      "score": 111,
      "shooting": [
        40,
        88,
        13,
        37
      ],
      "freeThrowsMade": 18,
      "periods": [
        {
          "shooting": [
            8,
            19,
            2,
            8
          ],
          "freeThrowsMade": 4,
          "points": 22
        },
        {
          "shooting": [
            14,
            19,
            6,
            9
          ],
          "freeThrowsMade": 8,
          "points": 42
        },
        {
          "shooting": [
            11,
            23,
            3,
            6
          ],
          "freeThrowsMade": 2,
          "points": 27
        },
        {
          "shooting": [
            7,
            27,
            2,
            14
          ],
          "freeThrowsMade": 4,
          "points": 20
        }
      ]
    },
    "away": {
      "teamId": 1610612759,
      "teamTricode": "SAS",
      "score": 115,
      "shooting": [
        39,
        84,
        12,
        34
      ],
      "freeThrowsMade": 25,
      "periods": [
        {
          "shooting": [
            14,
            23,
            4,
            7
          ],
          "freeThrowsMade": 1,
          "points": 33
        },
        {
          "shooting": [
            9,
            20,
            2,
            8
          ],
          "freeThrowsMade": 4,
          "points": 24
        },
        {
          "shooting": [
            10,
            20,
            5,
            10
          ],
          "freeThrowsMade": 10,
          "points": 35
        },
        {
          "shooting": [
            6,
            21,
            1,
            9
          ],
          "freeThrowsMade": 10,
          "points": 23
        }
      ]
    }
  },
  "0042500404": {
    "gameId": "0042500404",
    "gameCode": "20260610/SASNYK",
    "gameTimeUTC": "2026-06-11T00:30:00Z",
    "factsSha256": "dc056f93cf1e9c6ba9deb240b6da67525b28b41577aaa3808192a8c91cdabafe",
    "source": {
      "label": "NBA official game charts",
      "url": "https://www.nba.com/game/sas-vs-nyk-0042500404/game-charts",
      "retrievedAt": "2026-10-03T07:38:19.677708+00:00"
    },
    "home": {
      "teamId": 1610612752,
      "teamTricode": "NYK",
      "score": 107,
      "shooting": [
        36,
        78,
        15,
        32
      ],
      "freeThrowsMade": 20,
      "periods": [
        {
          "shooting": [
            5,
            17,
            2,
            5
          ],
          "freeThrowsMade": 10,
          "points": 22
        },
        {
          "shooting": [
            10,
            20,
            2,
            7
          ],
          "freeThrowsMade": 5,
          "points": 27
        },
        {
          "shooting": [
            9,
            21,
            5,
            10
          ],
          "freeThrowsMade": 3,
          "points": 26
        },
        {
          "shooting": [
            12,
            20,
            6,
            10
          ],
          "freeThrowsMade": 2,
          "points": 32
        }
      ]
    },
    "away": {
      "teamId": 1610612759,
      "teamTricode": "SAS",
      "score": 106,
      "shooting": [
        36,
        86,
        17,
        43
      ],
      "freeThrowsMade": 17,
      "periods": [
        {
          "shooting": [
            15,
            23,
            6,
            10
          ],
          "freeThrowsMade": 5,
          "points": 41
        },
        {
          "shooting": [
            13,
            24,
            8,
            16
          ],
          "freeThrowsMade": 1,
          "points": 35
        },
        {
          "shooting": [
            4,
            20,
            2,
            12
          ],
          "freeThrowsMade": 4,
          "points": 14
        },
        {
          "shooting": [
            4,
            19,
            1,
            5
          ],
          "freeThrowsMade": 7,
          "points": 16
        }
      ]
    }
  }
} as const;

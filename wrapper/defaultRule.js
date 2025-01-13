module.exports = {
  "name": "default",
  "version": 10000,
  "preprocess": [
    {
      "do": "fill",
      "from": "0 0 0",
      "to": "22 22 22",
      "block": "minecraft:bedrock"
    },
    {
      "do": "move",
      "to": "0 ~1 0"
    }
  ],
  "rule": {
    "module": [
      {
        "do": "loop",
        "list": [
          {
            "do": "try"
          },
          {
            "do": "move",
            "to": "~1~~"
          }
        ],
        "condition": {
          "target": "query.x",
          "operator": "!=",
          "value": 22
        }
      },
      {
        "do": "loop",
        "list": [
          {
            "do": "try"
          },
          {
            "do": "move",
            "to": "~~~1"
          }
        ],
        "condition": {
          "target": "query.z",
          "operator": "!=",
          "value": 22
        }
      },
      {
        "do": "loop",
        "list": [
          {
            "do": "try"
          },
          {
            "do": "move",
            "to": [
              "~-1",
              "~",
              "~"
            ]
          }
        ],
        "condition": {
          "target": "query.x",
          "operator": "!=",
          "value": 0
        }
      },
      {
        "do": "loop",
        "list": [
          {
            "do": "try"
          },
          {
            "do": "move",
            "to": [
              "~",
              "~",
              "~-1"
            ]
          }
        ],
        "condition": {
          "target": "query.z",
          "operator": "!=",
          "value": 0
        }
      }
    ],
    "chain": [

    ]
  }
}
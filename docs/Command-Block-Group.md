# Command Block Group Format
Command Block Group (CBG) format is a JSON-based data exchange format in order to store MCBE command blocks.

CBG is an abstract format that does not directly describe command blocks, but rather describes the connections between blocks and modules. This gives it great scalability and freedom. It can be wrapped into any command area style using a Wrapper with corresponding wrapping rule.

## Normal CBG
The normal CBG format only includes module, command chain, and command block data. It's easier to read and write.

Example:
```json
{
  "version": 10000,
  "type": "normal",
  "module": [
    {
      "id": "0",
      "chain": [
        {
          // 0 for impulse command block
          "type": 0,
          // Hover note‌
          "name": "Foo",
          "condition": false,
          "redstone": true,
          "delay": 0,
          // 0 for vannilla commands
          // directly put into the block
          "commandType": 0,
          "command": "say Hello"
        },
        {
          // 2 for chain command block
          "type": 2,
          "condition": false,
          "redstone": false,
          "delay": 0,
          "commandType": 0,
          "command": "say World"
        }
      ]
    }
  ]
}
```

### Module
CBG module contains several command chains, and can be operated as a whole by the ``start`` and ``stop`` instructions.

The key ``id`` indicates the identifier of the module. The identifier can be referenced by the ``start`` and ``stop`` instructions.

The key ``chain`` contains an array of command chains. 

### Chain
CBG command chain contains a series of command block. 

### Block

### Commands

## Symbol CBG

## Wrapping Rule
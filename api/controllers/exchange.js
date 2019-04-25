'use strict';

const ccxt = require('ccxt')
    , jwt = require('jsonwebtoken')
    , ccxtRestConfig = require('../config')
    , ccxtRestErrors = require('../errors')
    , db = require('../helpers/db')
    , exchange_response = require('../models/exchange-response')
    , controller_helper = require('../helpers/controller-helper')
    , jwtHelper = require('../helpers/jwt-helper')
    , handleError = controller_helper.handleError
    , execute = controller_helper.execute
    , getExchangeFromRequest = controller_helper.getExchangeFromRequest
    , getExchangeName = controller_helper.getExchangeName
    , getExchangeId = controller_helper.getExchangeId
    , renderExchange = controller_helper.renderExchange
;

module.exports = {
  list: list,
  createPrivateConnection: createPrivateConnection,
  getConnection : getConnection,
  deletePrivateConnection : deletePrivateConnection,
  markets: markets,
  orderBook: orderBook,
  l2OrderBook: l2OrderBook,
  trades: trades,
  ticker: ticker,
  tickers: tickers,
  balances: balances,
  createOrder: createOrder,
  cancelOrder: cancelOrder,
  fetchOrder: fetchOrder,
  fetchOrders: fetchOrders,
  fetchOpenOrders: fetchOpenOrders,
  fetchClosedOrders: fetchClosedOrders,
  fetchMyTrades: fetchMyTrades,
  directCall: directCall
};

function list(req, res) {
  try {
    res.send(ccxt.exchanges)
  } catch (error) {
    console.error('Error in list\n' + error)
    res.status(500).send()
  }
}

function createPrivateConnection(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'createPrivateConnection', (req, res) => {
    try {
      const exchangeName = getExchangeName(req)
  
      if (ccxt[exchangeName]) {
        const ccxtParam = req.body;
        const exchange = new ccxt[exchangeName](ccxtParam);
  
        db.saveExchange(exchangeName, exchange);

        jwtHelper.sign(
          exchangeName, 
          ccxtParam.id, 
          (err, token) => res.send(new exchange_response.AccessToken(token)))
      } else {
        res.status(404).send()
      }
    } catch (error) {
      handleError(req, res, 'createPrivateConnection', error)
    }
  })
}

function getConnection(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'getConnection', (req, res) => {
    try {
      const exchange = getExchangeFromRequest(req)
      
      renderExchange(exchange, res);
    } catch (error) {
      handleError(req, res, 'getConnection', error)
    }
  })
}

function deletePrivateConnection(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'deletePrivateConnection', (req, res) => {
    try {
      const exchangeId = getExchangeId(req)
      if (!exchangeId) {
        throw new ccxtRestErrors.MissingRequiredTokenError(`Required valid token but did not get any`)
      }
      const exchangeName = getExchangeName(req)

      const exchange = db.deleteExchange(exchangeName, exchangeId);

      renderExchange(exchange, res);  
    } catch (error) {
      handleError(req, res, 'deletePrivateConnection', error)
    }
  })
}

function markets(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'markets', (req, res) => {
    execute(req, res, 
      [], 
      'fetchMarkets', 
      (response) => response.map(rawMarket => new exchange_response.MarketResponse(rawMarket))
    )
  })
}

function orderBook(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'orderBook', (req, res) => {
    execute(req, res, 
      ['symbol', 'limit'], 
      'fetchOrderBook', 
      (response) => new exchange_response.OrderBookResponse(response)
    )
  })
}

function l2OrderBook(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'l2OrderBook', (req, res) => {
    execute(req, res, 
      ['symbol', 'limit'], 
      'fetchL2OrderBook', 
      (response) => new exchange_response.OrderBookResponse(response)
    )
  })
}

function trades(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'trades', (req, res) => {
    execute(req, res, 
      ['symbol', 'since', 'limit'], 
      'fetchTrades', 
      (response) => response.map(rawTrade => new exchange_response.TradeResponse(rawTrade))
    )
  })
}

function ticker(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'ticker', (req, res) => {
    execute(req, res, 
      ['symbol'], 
      'fetchTicker', 
      (response) => new exchange_response.TickerResponse(response)
    )
  })
}

function tickers(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'tickers', (req, res) => {
    execute(req, res, 
      ['symbol'], 
      'fetchTickers', 
      (response) => Object.keys(response).sort().map(symbol => new exchange_response.TickerResponse(response[symbol]))
    )
  })
}

function balances(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'balances', (req, res) => {
    execute(req, res, 
      [], 
      'fetchBalance', 
      (response) => new exchange_response.BalanceResponse(response)
    )
  })
}

function createOrder(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'createOrder', (req, res) => {
    execute(req, res, 
      (req, context) => {
        const orderPlacement = req.body;
        context.orderPlacement = orderPlacement
        const parameterValues = [orderPlacement.symbol, orderPlacement.type, orderPlacement.side, orderPlacement.amount, orderPlacement.price]
        return parameterValues
      }, 
      'createOrder', 
      (rawOrderPlacementResponse, context) => {
        const orderPlacement = context.orderPlacement
        let response = new exchange_response.OrderResponse(rawOrderPlacementResponse)
        if (!response.symbol) {
          response.symbol = orderPlacement.symbol
        }
        if (!response.type) {
          response.type = orderPlacement.type
        }
        if (!response.side) {
          response.side = orderPlacement.side
        }
        if (!response.amount) {
          response.amount = orderPlacement.amount
        }
        if (!response.price) {
          response.price = orderPlacement.price
        }
        return response
      }
    )
  })
}

function cancelOrder(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'cancelOrder', (req, res) => {
    execute(req, res, 
      ['orderId', 'symbol'], 
      'cancelOrder', 
      (rawOrderCancellationResponse, context) => {
        var response = new exchange_response.OrderResponse(rawOrderCancellationResponse)
        if (!response.id) {
          response.id = context[0]
        }
        if (!response.symbol) {
          response.symbol = context[1]
        }
        return response
      }
    )
  })
}

function fetchOrder(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'fetchOrder', (req, res) => {
    execute(req, res, 
      ['orderId', 'symbol'], 
      'fetchOrder', 
      (reponse) => new exchange_response.OrderResponse(reponse)
    )
  })
}

function fetchOrders(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'fetchOrders', (req, res) => {
    execute(req, res, 
      ['symbol', 'since', 'limit'], 
      'fetchOrders', 
      (reponse) => reponse.map(rawOrder => new exchange_response.OrderResponse(rawOrder))
    )
  })
}

function fetchOpenOrders(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'fetchOpenOrders', (req, res) => {
    execute(req, res, 
      ['symbol', 'since', 'limit'], 
      'fetchOpenOrders', 
      (response) => response.map(rawOrder => new exchange_response.OrderResponse(rawOrder))
    )
  })
}

function fetchClosedOrders(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'fetchClosedOrders', (req, res) => {
    execute(req, res, 
      ['symbol', 'since', 'limit'], 
      'fetchClosedOrders', 
      (response) => response.map(rawOrder => new exchange_response.OrderResponse(rawOrder))
    )
  })
}

function fetchMyTrades(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'fetchMyTrades', (req, res) => {
    execute(req, res, 
      ['symbol', 'since', 'limit'], 
      'fetchMyTrades', 
      (response) => response.map(rawTrade => new exchange_response.TradeResponse(rawTrade))
    )
  })
}

function directCall(req, res) {
  _doExchangeSpecificOrDefault(req, res, 'directCall', (req, res) => {
    var methodName = req.swagger.params.methodName.value;
    execute(req, res, 
      (req) => req.body,
      methodName, 
      (response) => response
    )
  })
}

function _doExchangeSpecificOrDefault(req, res, overrideFunctionName, defaultBehaviour) {
  try {
    const exchangeName = getExchangeName(req)
    if (exchangeName && ccxtRestConfig[exchangeName] 
        && ccxtRestConfig[exchangeName].override 
        && ccxtRestConfig[exchangeName].override[overrideFunctionName]) {
      ccxtRestConfig[exchangeName].override[overrideFunctionName](req, res, defaultBehaviour)
    } else {
      defaultBehaviour(req, res)
    }
  } catch (error) {
    handleError(req, res, overrideFunctionName, error)
  }
}


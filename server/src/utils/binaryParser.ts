/**
 * Binary Packet Parser for Dhan WebSocket Market Feed
 *
 * Parses binary responses from Dhan's WebSocket API.
 * All data is in Little Endian format.
 */

// Feed Response Codes
export enum FeedResponseCode {
  TICKER = 2,
  QUOTE = 4,
  OI_DATA = 5,
  PREV_CLOSE = 6,
  FULL = 8,
  DISCONNECTION = 50
}

// Exchange Segment Codes
export enum ExchangeSegment {
  IDX_I = 1,     // NSE Index
  NSE_EQ = 2,    // NSE Equity
  NSE_FNO = 3,   // NSE Futures & Options
  BSE_EQ = 4,    // BSE Equity
  MCX_COMM = 5   // MCX Commodity
}

// Response Header (8 bytes)
export interface ResponseHeader {
  feedCode: FeedResponseCode;
  messageLength: number;
  exchangeSegment: ExchangeSegment;
  securityId: string;
}

// Ticker Packet (code 2)
export interface TickerPacket extends ResponseHeader {
  ltp: number;      // Last Traded Price
  ltt: number;      // Last Trade Time (EPOCH in seconds)
}

// Quote Packet (code 4)
export interface QuotePacket extends ResponseHeader {
  ltp: number;
  ltq: number;      // Last Traded Quantity
  ltt: number;
  atp: number;      // Average Trade Price
  volume: number;
  totalSellQty: number;
  totalBuyQty: number;
  open: number;
  close: number;
  high: number;
  low: number;
}

// OI Data Packet (code 5)
export interface OIDataPacket extends ResponseHeader {
  openInterest: number;
}

// Prev Close Packet (code 6)
export interface PrevClosePacket extends ResponseHeader {
  prevClose: number;
  prevOpenInterest: number;
}

// Market Depth Level
export interface MarketDepthLevel {
  bidQty: number;
  askQty: number;
  bidOrders: number;
  askOrders: number;
  bidPrice: number;
  askPrice: number;
}

// Full Packet (code 8) - includes everything + market depth
export interface FullPacket extends ResponseHeader {
  ltp: number;
  ltq: number;
  ltt: number;
  atp: number;
  volume: number;
  totalSellQty: number;
  totalBuyQty: number;
  openInterest: number;
  highOI: number;
  lowOI: number;
  open: number;
  close: number;
  high: number;
  low: number;
  marketDepth: MarketDepthLevel[];  // 5 levels
}

// Disconnection Packet (code 50)
export interface DisconnectionPacket extends ResponseHeader {
  reasonCode: number;
}

/**
 * Parse Response Header (first 8 bytes of all packets)
 */
export function parseResponseHeader(buffer: Buffer): ResponseHeader {
  return {
    feedCode: buffer.readUInt8(0),
    messageLength: buffer.readUInt16LE(1),
    exchangeSegment: buffer.readUInt8(3),
    securityId: buffer.readUInt32LE(4).toString()
  };
}

/**
 * Parse Ticker Packet (code 2) - 16 bytes total
 * Bytes 0-8: Header
 * Bytes 9-12: LTP (float32)
 * Bytes 13-16: LTT (int32)
 */
export function parseTickerPacket(buffer: Buffer): TickerPacket {
  const header = parseResponseHeader(buffer);

  return {
    ...header,
    ltp: buffer.readFloatLE(8),
    ltt: buffer.readInt32LE(12)
  };
}

/**
 * Parse Quote Packet (code 4) - 50 bytes total
 */
export function parseQuotePacket(buffer: Buffer): QuotePacket {
  const header = parseResponseHeader(buffer);

  return {
    ...header,
    ltp: buffer.readFloatLE(8),
    ltq: buffer.readInt16LE(12),
    ltt: buffer.readInt32LE(14),
    atp: buffer.readFloatLE(18),
    volume: buffer.readInt32LE(22),
    totalSellQty: buffer.readInt32LE(26),
    totalBuyQty: buffer.readInt32LE(30),
    open: buffer.readFloatLE(34),
    close: buffer.readFloatLE(38),
    high: buffer.readFloatLE(42),
    low: buffer.readFloatLE(46)
  };
}

/**
 * Parse OI Data Packet (code 5) - 12 bytes total
 */
export function parseOIDataPacket(buffer: Buffer): OIDataPacket {
  const header = parseResponseHeader(buffer);

  return {
    ...header,
    openInterest: buffer.readInt32LE(8)
  };
}

/**
 * Parse Prev Close Packet (code 6) - 16 bytes total
 */
export function parsePrevClosePacket(buffer: Buffer): PrevClosePacket {
  const header = parseResponseHeader(buffer);

  return {
    ...header,
    prevClose: buffer.readFloatLE(8),
    prevOpenInterest: buffer.readInt32LE(12)
  };
}

/**
 * Parse Market Depth Level (20 bytes)
 */
function parseMarketDepthLevel(buffer: Buffer, offset: number): MarketDepthLevel {
  return {
    bidQty: buffer.readInt32LE(offset),
    askQty: buffer.readInt32LE(offset + 4),
    bidOrders: buffer.readInt16LE(offset + 8),
    askOrders: buffer.readInt16LE(offset + 10),
    bidPrice: buffer.readFloatLE(offset + 12),
    askPrice: buffer.readFloatLE(offset + 16)
  };
}

/**
 * Parse Full Packet (code 8) - 162 bytes total
 * Bytes 0-8: Header
 * Bytes 9-62: Price/Volume data
 * Bytes 63-162: Market Depth (5 levels × 20 bytes each = 100 bytes)
 */
export function parseFullPacket(buffer: Buffer): FullPacket {
  const header = parseResponseHeader(buffer);

  // Parse price/volume data (bytes 8-62)
  const data = {
    ...header,
    ltp: buffer.readFloatLE(8),
    ltq: buffer.readInt16LE(12),
    ltt: buffer.readInt32LE(14),
    atp: buffer.readFloatLE(18),
    volume: buffer.readInt32LE(22),
    totalSellQty: buffer.readInt32LE(26),
    totalBuyQty: buffer.readInt32LE(30),
    openInterest: buffer.readInt32LE(34),
    highOI: buffer.readInt32LE(38),
    lowOI: buffer.readInt32LE(42),
    open: buffer.readFloatLE(46),
    close: buffer.readFloatLE(50),
    high: buffer.readFloatLE(54),
    low: buffer.readFloatLE(58),
    marketDepth: [] as MarketDepthLevel[]
  };

  // Parse market depth (5 levels starting at byte 62)
  for (let i = 0; i < 5; i++) {
    const offset = 62 + (i * 20);
    data.marketDepth.push(parseMarketDepthLevel(buffer, offset));
  }

  return data;
}

/**
 * Parse Disconnection Packet (code 50) - 10 bytes total
 */
export function parseDisconnectionPacket(buffer: Buffer): DisconnectionPacket {
  const header = parseResponseHeader(buffer);

  return {
    ...header,
    reasonCode: buffer.readInt16LE(8)
  };
}

/**
 * Main parser function - routes to appropriate parser based on feed code
 */
export function parseDhanPacket(buffer: Buffer): TickerPacket | QuotePacket | OIDataPacket | PrevClosePacket | FullPacket | DisconnectionPacket | null {
  if (buffer.length < 8) {
    console.error('Buffer too small for Dhan packet (< 8 bytes)');
    return null;
  }

  const feedCode = buffer.readUInt8(0) as FeedResponseCode;

  try {
    switch (feedCode) {
      case FeedResponseCode.TICKER:
        return parseTickerPacket(buffer);

      case FeedResponseCode.QUOTE:
        return parseQuotePacket(buffer);

      case FeedResponseCode.OI_DATA:
        return parseOIDataPacket(buffer);

      case FeedResponseCode.PREV_CLOSE:
        return parsePrevClosePacket(buffer);

      case FeedResponseCode.FULL:
        return parseFullPacket(buffer);

      case FeedResponseCode.DISCONNECTION:
        return parseDisconnectionPacket(buffer);

      default:
        console.warn(`Unknown feed code: ${feedCode}`);
        return null;
    }
  } catch (error) {
    console.error('Error parsing Dhan packet:', error);
    return null;
  }
}

/**
 * Get disconnection reason message
 */
export function getDisconnectionReason(code: number): string {
  const reasons: Record<number, string> = {
    800: 'Server Shutdown',
    801: 'Duplicate Connection',
    802: 'Invalid Token',
    803: 'Token Expired',
    804: 'Invalid Client ID',
    805: 'Max Connections Exceeded (5 max)',
    806: 'Subscription Limit Exceeded (5000 instruments max)',
    807: 'Invalid Subscription Request',
    808: 'Client Timeout (no pong response)',
    809: 'Server Error',
    810: 'Maintenance Mode'
  };

  return reasons[code] || `Unknown reason (code: ${code})`;
}

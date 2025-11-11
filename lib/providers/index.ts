import { Quote } from '../types'
import { getQuoteYahoo } from './quote/yahoo'
import { getQuoteTwseDaily } from './quote/twse'
import { getNewsGoogleRss } from './news/googleRss'
import { getNewsYahooRss } from './news/yahooRss'

export async function getQuoteWithFallback(symbol: string): Promise<Quote> {
  try {
    return await getQuoteYahoo(symbol)
  } catch (e) {
    console.error('Yahoo quote fail, fallback TWSE:', e)
    return await getQuoteTwseDaily(symbol)
  }
}

export async function getIndustryNews(keyword: string, limit = 5) {
  try {
    return await getNewsGoogleRss(keyword, limit)
  } catch (e) {
    console.error('Google RSS fail, fallback Yahoo:', e)
    return await getNewsYahooRss(keyword, limit)
  }
}

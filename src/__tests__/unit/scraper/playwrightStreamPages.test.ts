import {
	isRiskControlError,
	ScraperHealthError,
} from '../../../scraper/playwrightStreamPages.ts';

describe('ScraperHealthError', () => {
	it('只保留裸 message 与上下文, 不拼日志前缀', () => {
		const error = new ScraperHealthError(
			15810,
			'upload',
			'接口返回错误码 -352: 风控校验失败',
			-352,
			'https://api.bilibili.com/x/space/wbi/arc/search?pn=1',
			'{"code":-352}',
		);

		expect( error.message ).toBe( '接口返回错误码 -352: 风控校验失败' );
		expect( error.message ).not.toContain( '[采集失败]' );
		expect( error.code ).toBe( -352 );
		expect( error.requestUrl ).toContain( 'arc/search' );
		expect( error.responseBody ).toBe( '{"code":-352}' );
	} );
} );

describe('isRiskControlError', () => {
	it.each( [ -101, -352, -412 ] )( '识别风控 / 登录态错误码 %i', code => {
		const error = new ScraperHealthError( 1400350754, 'upload', 'x', code );
		expect( isRiskControlError( error ) ).toBe( true );
	} );

	it( '其它错误码不算风控', () => {
		expect( isRiskControlError( new ScraperHealthError( 1, 'upload', 'x', -400 ) ) )
			.toBe( false );
	} );

	it( '没有错误码的错误不算风控', () => {
		expect( isRiskControlError( new ScraperHealthError( 1, 'upload', 'x' ) ) )
			.toBe( false );
	} );

	it( '普通 Error 即使消息里带 -352 也不算风控', () => {
		expect( isRiskControlError( new Error( '-352 风控校验失败' ) ) ).toBe( false );
	} );
} );

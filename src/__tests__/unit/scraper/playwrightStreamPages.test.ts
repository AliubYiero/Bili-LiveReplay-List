import {
	isRiskControlError,
	ScraperHealthError,
} from '../../../scraper/playwrightStreamPages.ts';

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

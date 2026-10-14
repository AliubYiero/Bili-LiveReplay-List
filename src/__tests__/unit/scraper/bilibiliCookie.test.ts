import type { BrowserContext } from 'playwright';
import {
  assertBilibiliCookie,
  applyBilibiliCookie,
  BILIBILI_COOKIE_ENV,
  hasBilibiliCookie,
  parseBilibiliCookie,
} from '../../../scraper/bilibiliCookie.ts';

const createContext = () => ({
  addCookies: jest.fn().mockResolvedValue( undefined ),
}) as unknown as BrowserContext & { addCookies: jest.Mock };

describe('parseBilibiliCookie', () => {
  it('解析常见的 cookie 串', () => {
    const cookies = parseBilibiliCookie(
      'SESSDATA=abc%2Cdef*ghi; bili_jct=JCT123; DedeUserID=690608693',
    );

    expect( cookies ).toEqual( [
      { name: 'SESSDATA', value: 'abc%2Cdef*ghi', domain: '.bilibili.com', path: '/' },
      { name: 'bili_jct', value: 'JCT123', domain: '.bilibili.com', path: '/' },
      { name: 'DedeUserID', value: '690608693', domain: '.bilibili.com', path: '/' },
    ] );
  } );

  it('值里允许出现等号', () => {
    const cookies = parseBilibiliCookie( 'a=b=c' );

    expect( cookies ).toHaveLength( 1 );
    expect( cookies[ 0 ] ).toMatchObject( { name: 'a', value: 'b=c' } );
  } );

  it('没有等号的片段被忽略', () => {
    expect( parseBilibiliCookie( 'SESSDATA=x; garbage; DedeUserID=1' ) ).toHaveLength( 2 );
  } );

  it('空名字的片段被忽略', () => {
    expect( parseBilibiliCookie( '=x; SESSDATA=y' ) ).toHaveLength( 1 );
  } );

  it('多余的空格与分号被容忍', () => {
    const cookies = parseBilibiliCookie( '  SESSDATA=x ;;  bili_jct = y ; ' );

    expect( cookies ).toEqual( [
      { name: 'SESSDATA', value: 'x', domain: '.bilibili.com', path: '/' },
      { name: 'bili_jct', value: 'y', domain: '.bilibili.com', path: '/' },
    ] );
  } );

  it('空串与未定义返回空数组', () => {
    expect( parseBilibiliCookie( '' ) ).toEqual( [] );
    expect( parseBilibiliCookie( '   ' ) ).toEqual( [] );
    expect( parseBilibiliCookie( undefined ) ).toEqual( [] );
  } );

  it('默认从环境变量读取', () => {
    process.env[ BILIBILI_COOKIE_ENV ] = 'SESSDATA=fromEnv';
    expect( parseBilibiliCookie() ).toHaveLength( 1 );
    delete process.env[ BILIBILI_COOKIE_ENV ];
  } );
} );

describe('hasBilibiliCookie', () => {
  const originalValue = process.env[ BILIBILI_COOKIE_ENV ];

  afterEach( () => {
    if ( originalValue === undefined ) delete process.env[ BILIBILI_COOKIE_ENV ];
    else process.env[ BILIBILI_COOKIE_ENV ] = originalValue;
  } );

  it('未配置时为 false', () => {
    delete process.env[ BILIBILI_COOKIE_ENV ];
    expect( hasBilibiliCookie() ).toBe( false );
  } );

  it('配置后为 true', () => {
    process.env[ BILIBILI_COOKIE_ENV ] = 'SESSDATA=x';
    expect( hasBilibiliCookie() ).toBe( true );
  } );
} );

describe('applyBilibiliCookie', () => {
  const originalValue = process.env[ BILIBILI_COOKIE_ENV ];

  afterEach( () => {
    if ( originalValue === undefined ) delete process.env[ BILIBILI_COOKIE_ENV ];
    else process.env[ BILIBILI_COOKIE_ENV ] = originalValue;
  } );

  it('注入 cookie 并返回 true', async () => {
    process.env[ BILIBILI_COOKIE_ENV ] = 'SESSDATA=x; bili_jct=y';
    const context = createContext();

    await expect( applyBilibiliCookie( context ) ).resolves.toBe( true );
    expect( context.addCookies ).toHaveBeenCalledTimes( 1 );
    expect( context.addCookies.mock.calls[ 0 ][ 0 ] ).toHaveLength( 2 );
  } );

  it('没有配置时跳过注入并返回 false', async () => {
    delete process.env[ BILIBILI_COOKIE_ENV ];
    const context = createContext();

    await expect( applyBilibiliCookie( context ) ).resolves.toBe( false );
    expect( context.addCookies ).not.toHaveBeenCalled();
  } );
} );

describe('assertBilibiliCookie', () => {
  const originalValue = process.env[ BILIBILI_COOKIE_ENV ];

  afterEach( () => {
    if ( originalValue === undefined ) delete process.env[ BILIBILI_COOKIE_ENV ];
    else process.env[ BILIBILI_COOKIE_ENV ] = originalValue;
  } );

  it('需要登录且已配置时不抛错', () => {
    process.env[ BILIBILI_COOKIE_ENV ] = 'SESSDATA=x';
    expect( () => assertBilibiliCookie( true ) ).not.toThrow();
  } );

  it('需要登录但未配置时抛出配置错误', () => {
    delete process.env[ BILIBILI_COOKIE_ENV ];
    expect( () => assertBilibiliCookie( true ) ).toThrow(
      new RegExp( `请在环境变量 ${ BILIBILI_COOKIE_ENV } 中配置` ),
    );
  } );

  it('不需要登录时未配置也不抛错', () => {
    delete process.env[ BILIBILI_COOKIE_ENV ];
    expect( () => assertBilibiliCookie( false ) ).not.toThrow();
  } );
} );

/**
 * 单个拼写纠正规则
 */
export interface SpellingRule {
  /** 错误的游戏名 */
  from: string;
  /** 正确的游戏名 */
  to: string;
}

/**
 * UID 专属规则集合
 */
export interface UidSpellingRules {
  rules: SpellingRule[];
}

/**
 * SpellingCorrection V2 配置文件结构
 */
export interface SpellingCorrectionConfig {
  /** 配置文件版本，当前为 "2.0" */
  version: string;
  /** 全局规则，适用于所有主播 */
  global: UidSpellingRules;
  /** UID 专属规则，key 为 UID 字符串 */
  uidRules: Record<string, UidSpellingRules>;
}

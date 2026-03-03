import React from 'react';
import { Lightbulb, BarChart3, Zap } from 'lucide-react';
import type { Arena } from '../types/supabase';

interface ArenaRuleCardProps {
  mode: Arena['mode'];
}

const RULE_CONFIG = {
  pitch: {
    icon: Lightbulb,
    emoji: '💡',
    label: '方案赛马',
    rule: '规则：提交完整方案书(PDF)或Demo视频。由发布者进行综合评审，选出最佳创意与落地性方案。',
    color: 'from-amber-500/20 to-amber-600/10',
    borderColor: 'border-amber-500/40',
    iconColor: 'text-amber-400',
  },
  benchmark: {
    icon: BarChart3,
    emoji: '🏎️',
    label: '榜单打擂',
    rule: '规则：提交算法模型或运行结果。系统/发布者根据准确率指标打分，分数最高者独揽大奖。',
    color: 'from-blue-500/20 to-blue-600/10',
    borderColor: 'border-blue-500/40',
    iconColor: 'text-blue-400',
  },
  speed: {
    icon: Zap,
    emoji: '⚡',
    label: '极速猎人',
    rule: '规则：争分夺秒！首个提交有效代码并通过验证的开发者即刻胜出。手慢无！',
    color: 'from-purple-500/20 to-purple-600/10',
    borderColor: 'border-purple-500/40',
    iconColor: 'text-purple-400',
  },
};

export const ArenaRuleCard: React.FC<ArenaRuleCardProps> = ({ mode }) => {
  if (!mode || !RULE_CONFIG[mode]) return null;

  const config = RULE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.borderColor} bg-gradient-to-br ${config.color} backdrop-blur-md p-5 mb-8`}>
      <div className="flex items-start gap-4">
        <div className={`shrink-0 p-3 rounded-lg bg-slate-900/50 border ${config.borderColor}`}>
          <Icon size={24} className={config.iconColor} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{config.emoji}</span>
            <span className={`font-semibold ${config.iconColor}`}>{config.label}</span>
          </div>
          <p className="text-slate-200 text-sm leading-relaxed">{config.rule}</p>
        </div>
      </div>
    </div>
  );
};

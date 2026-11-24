/* ============================================================
   AI OFFICE v1 — engine
   주제 감지 · 회의 턴 구성 · 시뮬레이션 발언 생성 · 실제 API 호출
   ============================================================ */

const Engine = (() => {
  const EMP = () => EMPLOYEES;

  function mulberry(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(arr, rand) {
    return arr[Math.floor(rand() * arr.length) % arr.length];
  }

  /* 안건에서 주제 태그와 핵심 키워드 추출 */
  function analyse(agenda) {
    const text = (agenda || '').trim();
    const scores = {};
    Object.keys(TOPIC_KEYWORDS).forEach(k => {
      scores[k] = TOPIC_KEYWORDS[k].reduce((n, w) => n + (text.indexOf(w) >= 0 ? 1 : 0), 0);
    });
    let topic = 'general';
    let best = 0;
    Object.keys(scores).forEach(k => {
      if (scores[k] > best) { best = scores[k]; topic = k; }
    });
    if (best === 0) {
      // 직원 역할에서 주제를 추정 (선택 팀 기반)
      topic = 'general';
    }
    const words = text.replace(/[「」『』?!.,]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    const kw = words.find(w => w.length >= 3 && w.length <= 12) || '';
    return { topic, kw, words };
  }

  /* 주제에 맞는 추천 참여자 (프리셋이 없을 때) */
  function suggestParticipants(topic) {
    const base = ['sec'];
    const map = {
      stock: ['stock-market', 'stock-chart', 'stock-risk'],
      realty: ['realty-site', 'realty-deal'],
      content: ['content-blog', 'content-short'],
      japan: ['japan-loc', 'japan-biz'],
      qa: ['qa'],
      general: ['sec']
    };
    const ids = base.concat(map[topic] || []);
    if (!ids.includes('qa')) ids.push('qa');
    return ids;
  }

  /* 회의 턴 계획: [{who, kind}] */
  function planTurns(agenda, participantIds) {
    const { topic } = analyse(agenda);
    const ids = participantIds.filter(id => id !== 'sec');
    const turns = [{ who: 'sec', kind: 'open' }];

    // 1라운드: 역할별 의견 — 비서실 → 팀 순서
    ids.forEach(id => turns.push({ who: id, kind: 'opinion' }));

    // 2라운드: 검수/리스크
    let reviewer = null;
    if (ids.includes('stock-risk') && (topic === 'stock' || topic === 'general')) reviewer = 'stock-risk';
    else if (ids.includes('qa')) reviewer = 'qa';
    else if (ids.includes('stock-risk')) reviewer = 'stock-risk';
    if (!reviewer) reviewer = ids[0] || 'qa';

    turns.push({ who: reviewer, kind: 'review' });
    // 발언자 한 명이 검수 의견에 응답
    const responder = ids.find(id => id !== reviewer) || null;
    if (responder) turns.push({ who: responder, kind: 'reply', to: reviewer });
    turns.push({ who: 'sec', kind: 'report' });
    return { turns, topic, reviewer };
  }

  function ctxFor(agenda, participantIds, seed) {
    const info = analyse(agenda);
    const teamNames = Array.from(new Set(participantIds.map(id => {
      const e = EMPLOYEES.find(x => x.id === id);
      return e ? TEAMS[e.team].name : '';
    }).filter(Boolean)));
    return {
      topic: agenda,
      kw: info.kw,
      topicTag: info.topic,
      teamNames: teamNames.join(' · '),
      rand: mulberry(seed),
      dateLabel: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    };
  }

  function simTurnText(turn, ctx, report) {
    const e = EMPLOYEES.find(x => x.id === turn.who);
    if (!e) return '';
    const scripts = ROLE_SCRIPTS[e.id] || [];
    switch (turn.kind) {
      case 'open':
        return pick(SEC_OPEN, ctx.rand)(ctx);
      case 'opinion':
        return scripts.length ? pick(scripts, ctx.rand)(ctx) : `「${ctx.topic}」 관련해 제 역할 범위에서 확인한 내용부터 공유하겠습니다. 기준일과 출처를 함께 정리해 두겠습니다.`;
      case 'review':
        return scripts.length ? pick(scripts, ctx.rand)(ctx) : `검수 관점에서 두 가지만 확인하겠습니다. 숫자의 기준일과 출처가 있는지, 단정 표현이 없는지입니다.`;
      case 'reply': {
        const to = EMPLOYEES.find(x => x.id === turn.to);
        const toName = to ? to.short : '검수';
        return `${toName} 지적 반영하겠습니다. 실행 조건을 수치로 고정하고, 기준일·출처 표기를 산출물에 넣겠습니다. ${ctx.topicTag === 'stock' ? '진입은 3분할, 손실 한도 -2%로 조정합니다.' : '다음 회의 전까지 중간 결과를 공유하겠습니다.'}`;
      }
      case 'report':
        return pick(SEC_CLOSE, ctx.rand)(ctx);
      default:
        return '';
    }
  }

  function buildReport(ctx) {
    const tpl = REPORT_TEMPLATES[ctx.topicTag] || REPORT_TEMPLATES.general;
    return {
      title: ctx.topic,
      dateLabel: ctx.dateLabel,
      decisions: tpl.decisions.slice(),
      evidence: tpl.evidence.slice(),
      risks: tpl.risks.map(r => ({ ...r })),
      actions: tpl.actions.map(a => ({ ...a }))
    };
  }

  /* ---------------- 실제 API 모드 ---------------- */
  function buildApiMessages(turn, ctx, history, report) {
    const e = EMPLOYEES.find(x => x.id === turn.who);
    const sys = (e ? e.prompt : '') + `\n\n[회의 상황]
- 오늘 안건: ${ctx.topic}
- 참여 팀: ${ctx.teamNames}
- 당신의 발언 순서: ${turn.kind === 'open' ? '회의 소집' : turn.kind === 'opinion' ? '의견 제시' : turn.kind === 'review' ? '리스크·검수 지적' : turn.kind === 'reply' ? '검수 의견에 대한 응답' : '최종 보고'}
- 답변은 한국어 2~4문장. 인사말·머리말 없이 본론만. 이모지 금지. 확인되지 않은 수치는 '확인 필요'로 표시.`;

    let transcript = history.map(h => `${h.name}: ${h.text}`).join('\n');
    const user = `지금까지의 회의 발언입니다.\n\n${transcript || '(아직 발언 없음)'}\n\n이제 '${e ? e.name : ''}'(으)로서 ${turn.kind === 'open' ? '회의를 시작하며 안건과 진행 순서를 알리세요' : turn.kind === 'report' ? '결정사항·근거·리스크·다음 액션(담당·기한)을 담은 최종 보고를 3~6줄로 정리하세요' : '2~4문장으로 발언하세요'}.`;
    return [{ role: 'user', content: user }];
  }

  async function callAPI(settings, system, messages, maxTokens = 500) {
    if (!settings.key) throw new Error('NO_KEY');
    if (settings.provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.key
        },
        body: JSON.stringify({
          model: settings.model || 'gpt-4o-mini',
          messages: [{ role: 'system', content: system }, ...messages],
          temperature: 0.7,
          max_tokens: maxTokens
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error('API ' + res.status + (body ? ' · ' + body.slice(0, 160) : ''));
      }
      const data = await res.json();
      return (data.choices && data.choices[0] && data.choices[0].message.content || '').trim();
    }
    if (settings.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: settings.model || 'claude-3-5-haiku-latest',
          max_tokens: maxTokens,
          system: system,
          messages: messages
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error('API ' + res.status + (body ? ' · ' + body.slice(0, 160) : ''));
      }
      const data = await res.json();
      const block = (data.content || []).find(c => c.type === 'text');
      return (block ? block.text : '').trim();
    }
    throw new Error('UNKNOWN_PROVIDER');
  }

  async function testConnection(settings) {
    if (settings.provider === 'sim') return { ok: true, note: '시뮬레이션 모드 — 키가 필요 없습니다.' };
    const text = await callAPI(settings, 'You are a connection test. Reply with exactly: OK', [{ role: 'user', content: 'ping' }], 12);
    return { ok: true, note: '연결 성공 · 응답: ' + (text || '(빈 응답)').slice(0, 60) };
  }

  return { analyse, suggestParticipants, planTurns, ctxFor, simTurnText, buildReport, buildApiMessages, callAPI, testConnection, mulberry };
})();

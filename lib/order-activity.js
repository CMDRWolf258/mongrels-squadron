const CLOSED = new Set(['complete','completed','closed','cancelled','canceled','inactive']);

export async function readCurrentOrderCycle(env) {
  if (!env?.DAILY_ORDERS || typeof env.DAILY_ORDERS.get !== 'function') return null;
  const current = await env.DAILY_ORDERS.get('current',{type:'json'});
  return current && typeof current === 'object' ? current : null;
}

export function matchVerifiedActivity(events, current) {
  const orders = (Array.isArray(current?.orders) ? current.orders : []).filter(isActiveOrder);
  const cycleStartedAt = current?.cycleStartedAt || current?.updatedAt || null;
  const annotated = [];
  const totals = {};

  for (const event of Array.isArray(events) ? events : []) {
    const components = activityComponents(event);
    const matches = [];
    const unmatched = [];
    const ambiguous = [];

    for (const component of components) {
      const candidates = orders.filter(order => qualifies(order, component, event, cycleStartedAt));
      if (candidates.length === 1) {
        const order = candidates[0];
        const match = {
          eventId:event.id || '',
          orderId:order.id || '',
          logicalKey:order.logicalKey || '',
          revision:Number(order.revision)||1,
          orderTask:order.task || 'Daily Order',
          orderTarget:numberOrNull(order?.reporting?.target),
          type:component.type,
          contribution:round(component.contribution),
          unit:component.unit,
          faction:component.faction || '',
          system:component.system || '',
          timestamp:event.timestamp || '',
        };
        matches.push(match);
        const bucket = totals[order.id] || {
          orderId:order.id,
          logicalKey:order.logicalKey || '',
          revision:Number(order.revision)||1,
          task:order.task || 'Daily Order',
          type:component.type,
          system:order.system || '',
          faction:order.faction || '',
          target:numberOrNull(order?.reporting?.target),
          contribution:0,
          unit:component.unit,
          eventCount:0,
        };
        bucket.contribution = round(bucket.contribution + component.contribution);
        bucket.eventCount += 1;
        totals[order.id] = bucket;
      } else if (candidates.length > 1) {
        ambiguous.push({
          type:component.type,
          contribution:round(component.contribution),
          unit:component.unit,
          faction:component.faction || '',
          system:component.system || '',
          candidateOrderIds:candidates.map(order=>order.id),
        });
      } else {
        unmatched.push(component);
      }
    }

    annotated.push({
      ...event,
      orderMatches:matches,
      orderMatchStatus:ambiguous.length ? 'ambiguous' : matches.length ? 'matched' : 'unmatched',
      orderMatchAmbiguous:ambiguous,
      orderMatchUnmatched:unmatched,
    });
  }

  return {
    cycleId:current?.cycleId || null,
    cycleStartedAt,
    orderTotals:Object.values(totals),
    events:annotated,
  };
}

function activityComponents(event) {
  if (!event || typeof event !== 'object') return [];

  if (event.type === 'mission_inf') {
    return (Array.isArray(event.effects) ? event.effects : [])
      .map(effect => ({
        type:'inf',
        contribution:Number(effect?.infUnits)||0,
        unit:'INF',
        faction:clean(effect?.faction),
        system:clean(event.affectedSystem || event.system),
      }))
      .filter(item => item.contribution > 0 && item.faction && item.system);
  }

  if (event.type === 'bounties_redeemed') {
    const split = (Array.isArray(event.factions) ? event.factions : [])
      .map(item => ({
        type:'bounties',
        contribution:(Number(item?.amount)||0)/1_000_000,
        unit:'M Cr',
        faction:clean(item?.faction),
        system:clean(event.system),
      }))
      .filter(item => item.contribution > 0 && item.faction && item.system);
    if (split.length) return split;
    const faction = clean(event.faction);
    const amount = (Number(event.amount)||0)/1_000_000;
    return faction && amount > 0 && event.system ? [{
      type:'bounties',contribution:amount,unit:'M Cr',faction,system:clean(event.system)
    }] : [];
  }

  if (event.type === 'market_sell') {
    const profit = Number(event.profit);
    if (event.profitKnown !== true || !Number.isFinite(profit) || profit <= 0) return [];
    return [{
      type:'trade',
      contribution:profit/1_000_000,
      unit:'M Cr',
      faction:clean(event.stationFaction),
      system:clean(event.system),
    }].filter(item=>item.faction&&item.system);
  }

  if (event.type === 'exploration_sale') {
    const amount = Number(event.amount)||0;
    return amount > 0 ? [{
      type:'exploration',
      contribution:amount/1_000_000,
      unit:'M Cr',
      faction:clean(event.stationFaction),
      system:clean(event.system),
    }].filter(item=>item.faction&&item.system) : [];
  }

  return [];
}

function qualifies(order, component, event, cycleStartedAt) {
  const type = clean(order?.reporting?.type);
  if (type !== component.type) return false;
  if (norm(order.system) !== norm(component.system)) return false;
  if (norm(order.faction) !== norm(component.faction)) return false;

  const eventTime = Date.parse(event?.timestamp || '');
  const orderStart = Date.parse(order?.createdAt || cycleStartedAt || '');
  if (Number.isFinite(eventTime) && Number.isFinite(orderStart) && eventTime < orderStart) return false;

  return true;
}

function isActiveOrder(order) {
  return !CLOSED.has(norm(order?.status));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function norm(value) {
  return clean(value).toLowerCase().replace(/\s+/g,' ');
}

function round(value) {
  return Math.round((Number(value)||0)*1000)/1000;
}

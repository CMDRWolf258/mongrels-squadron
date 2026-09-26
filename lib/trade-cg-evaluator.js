import {
  CG_PROMOTION_HOLD_MINUTES,
  cgRouteEligibleForPrimary,
  normalizeCgRoute,
  normalizeTradeCgCampaign,
  readTradeCgCampaigns,
  solveTradeCgCampaign,
  writeTradeCgCampaigns,
} from './trade-cg.js';
import { syncTradeCgDiscord } from './trade-cg-discord.js';

export const TRADE_CG_EVALUATION_BATCH_SIZE=2;

export async function evaluateTradeCgCampaigns(env,{
  maxCampaigns=TRADE_CG_EVALUATION_BATCH_SIZE,
  campaignIds=[],
  force=false,
  origin='',
  fetchImpl=fetch,
  now=Date.now(),
}={}){
  const campaigns=await readTradeCgCampaigns(env);
  const wanted=new Set((Array.isArray(campaignIds)?campaignIds:[]).map(String));
  const active=campaigns.filter(campaign=>{
    if(campaign.status!=='active')return false;
    const end=Date.parse(campaign.endsAt||'');
    return !Number.isFinite(end)||end>now;
  });
  const due=active
    .filter(campaign=>!wanted.size||wanted.has(campaign.id))
    .filter(campaign=>force||cgCampaignDueAt(campaign)<=now)
    .sort((a,b)=>cgCampaignDueAt(a)-cgCampaignDueAt(b));
  const selected=due.slice(0,Math.max(1,Math.min(5,Number(maxCampaigns)||TRADE_CG_EVALUATION_BATCH_SIZE)));
  const evaluated=[];
  for(const campaign of selected){
    evaluated.push(await evaluateOne(env,campaign,{origin,fetchImpl,now}));
  }

  let changed=false;
  for(const result of evaluated){
    const index=campaigns.findIndex(item=>item.id===result.campaign?.id);
    if(index<0||!result.campaign)continue;
    campaigns[index]=result.campaign;
    changed=true;
  }
  if(changed)await writeTradeCgCampaigns(env,campaigns);

  return{
    ok:true,
    active:active.length,
    due:due.length,
    selected:selected.length,
    succeeded:evaluated.filter(row=>row.ok).length,
    failed:evaluated.filter(row=>!row.ok).length,
    results:evaluated.map(row=>({
      id:row.campaign?.id||row.id||'',
      ok:row.ok,
      transition:row.transition||'',
      primaryKey:row.campaign?.primary?.key||'',
      pendingKey:row.campaign?.pendingPrimary?.route?.key||'',
      pendingPromoteAfter:row.campaign?.pendingPrimary?.promoteAfter||'',
      error:row.error||'',
    })),
  };
}

export function cgCampaignDueAt(campaign){
  const refresh=Math.max(5,Number(campaign?.automation?.refreshMinutes)||15);
  const last=Date.parse(campaign?.evaluation?.lastAttemptAt||campaign?.evaluation?.lastEvaluatedAt||'');
  if(!Number.isFinite(last))return 0;
  return last+refresh*60000;
}

export function promoteTradeCgPending(campaign,{now=Date.now(),reason='officer_override'}={}){
  const normalized=normalizeTradeCgCampaign(campaign);
  const pending=normalized?.pendingPrimary?.route;
  if(!normalized||!pending||!cgRouteEligibleForPrimary(pending))return normalized;
  normalized.primary={
    ...normalizeCgRoute(pending),
    promotedAt:new Date(now).toISOString(),
    promotionReason:reason,
  };
  normalized.pendingPrimary=null;
  normalized.updatedAt=new Date(now).toISOString();
  return normalized;
}

async function evaluateOne(env,campaign,{origin,fetchImpl,now}){
  const attemptedAt=new Date(now).toISOString();
  const refresh=Math.max(5,Number(campaign?.automation?.refreshMinutes)||15);
  const nextEvaluationAt=new Date(now+refresh*60000).toISOString();
  const previousPrimary=campaign.primary;
  const previousPending=campaign.pendingPrimary;

  try{
    const solved=await solveTradeCgCampaign(env,campaign,campaign.automation,{
      fetchImpl,
      timeoutMs:22000,
      now,
      includePrimaryKey:previousPrimary?.key||'',
    });
    const topEligible=solved.results.find(cgRouteEligibleForPrimary)||null;
    let primary=previousPrimary?{...previousPrimary}:null;
    let pendingPrimary=previousPending?{...previousPending}:null;
    let transition='';

    if(primary){
      const observed=solved.primaryObservation;
      if(observed){
        primary={
          ...primary,
          ...normalizeCgRoute(observed),
          promotedAt:primary.promotedAt,
          promotionReason:primary.promotionReason,
        };
      }else{
        primary={...primary,healthy:false,state:'missing'};
      }
    }

    if(!primary&&topEligible){
      primary={
        ...normalizeCgRoute(topEligible),
        promotedAt:attemptedAt,
        promotionReason:'initial_auto_primary',
      };
      pendingPrimary=null;
      transition='primary_initialized';
    }else if(primary&&topEligible){
      if(topEligible.key===primary.key){
        primary={
          ...normalizeCgRoute(topEligible),
          promotedAt:primary.promotedAt,
          promotionReason:primary.promotionReason,
        };
        pendingPrimary=null;
      }else if(pendingPrimary?.route?.key===topEligible.key){
        const promoteAfter=Date.parse(pendingPrimary.promoteAfter||'');
        if(Number.isFinite(promoteAfter)&&now>=promoteAfter){
          primary={
            ...normalizeCgRoute(topEligible),
            promotedAt:attemptedAt,
            promotionReason:'auto_after_1h_stable',
          };
          pendingPrimary=null;
          transition='primary_promoted';
        }else{
          pendingPrimary={
            ...pendingPrimary,
            route:normalizeCgRoute(topEligible),
          };
        }
      }else{
        pendingPrimary={
          route:normalizeCgRoute(topEligible),
          firstSeenAt:attemptedAt,
          promoteAfter:new Date(now+CG_PROMOTION_HOLD_MINUTES*60000).toISOString(),
        };
        transition='candidate_started';
      }
    }else if(primary&&!topEligible){
      pendingPrimary=null;
    }

    const updated=normalizeTradeCgCampaign({
      ...campaign,
      primary,
      pendingPrimary,
      evaluation:{
        lastAttemptAt:attemptedAt,
        lastEvaluatedAt:attemptedAt,
        nextEvaluationAt,
        lastError:'',
        lastWarning:solved.warning||'',
        stationCount:solved.stationCount,
        sourceResultCount:solved.sourceResultCount,
        partial:Boolean(solved.partial),
      },
      updatedAt:attemptedAt,
      updatedBy:'CG Route Solver',
    });

    const discord=await syncTradeCgDiscord(env,{
      campaign:updated,
      origin,
      transition,
    });
    updated.discord={
      ...(updated.discord||{}),
      messageId:discord?.messageId||updated.discord?.messageId||'',
      channelId:discord?.channelId||updated.discord?.channelId||'',
      lastSyncedAt:discord?.ok&&discord?.attempted?attemptedAt:(updated.discord?.lastSyncedAt||''),
      lastError:discord?.ok?'':(discord?.error||updated.discord?.lastError||''),
    };

    return{ok:true,transition,campaign:updated};
  }catch(error){
    const updated=normalizeTradeCgCampaign({
      ...campaign,
      evaluation:{
        ...(campaign.evaluation||{}),
        lastAttemptAt:attemptedAt,
        nextEvaluationAt,
        lastError:friendly(error),
      },
      updatedAt:attemptedAt,
      updatedBy:'CG Route Solver',
    });
    return{ok:false,id:campaign.id,error:friendly(error),campaign:updated};
  }
}

function friendly(error){
  const code=String(error?.message||error||'cg_evaluation_failed').split(':')[0];
  if(code==='cg_destination_market_not_found')return'CG destination market was not found in the current market snapshot.';
  if(code==='loop_source_timeout')return'CG market snapshot timed out.';
  if(code.startsWith('loop_source_http_')||code==='loop_source_invalid_response')return'CG market source was unavailable.';
  return code;
}

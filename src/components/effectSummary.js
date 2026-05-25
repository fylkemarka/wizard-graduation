// Plain-text summary helpers for equipment / relic effect bullet lists.
// Used by combat screen tooltips and by App.jsx's grant-screen breakdowns.
// Extracted from App.jsx so CombatScreen.jsx can import without circular
// dependency back to App.

export function equipmentEffectSummary(equipment) {
  const bonus = equipment?.bonus || {};
  const effect = equipment?.effect || {};
  const lines = [];
  if (bonus.maxHp)                 lines.push(`• +${bonus.maxHp} max HP (permanent)`);
  if (bonus.startBlock)            lines.push(`• +${bonus.startBlock} Block at the start of every combat`);
  if (bonus.healOnCombatStart)     lines.push(`• +${bonus.healOnCombatStart} HP at the start of every combat`);
  if (bonus.extraStartHand)        lines.push(`• +${bonus.extraStartHand} cards drawn on turn 1`);
  if (bonus.energyOnCombatStart)   lines.push(`• +${bonus.energyOnCombatStart} Energy on turn 1`);
  if (bonus.permanentEnergyBonus)  lines.push(`• +${bonus.permanentEnergyBonus} Energy every turn (permanent)`);
  if (bonus.damageReduction)       lines.push(`• −${bonus.damageReduction} dmg per incoming hit (capped at 2 across equipment)`);
  if (bonus.startCombatVulnerable) lines.push(`• Enemy starts +${bonus.startCombatVulnerable * 25}% incoming damage`);
  if (bonus.startCombatWeak)       lines.push(`• Enemy starts -${bonus.startCombatWeak * 25}% attack damage`);
  if (bonus.strikeBonus)           lines.push(`• +${bonus.strikeBonus} dmg to any Effect card named "Strike"`);
  if (effect.startOfTurnBlock)     lines.push(`• +${effect.startOfTurnBlock} Block at the start of every turn`);
  if (effect.firstHitReduction)    lines.push(`• −${effect.firstHitReduction} damage on the FIRST enemy hit each combat`);
  if (effect.combatEndHeal)        lines.push(`• +${effect.combatEndHeal} HP at the end of every combat`);
  if (effect.startCombatPoise)     lines.push(`• +${effect.startCombatPoise} Poise at the start of every combat`);
  if (effect.startCombatVulnerable) lines.push(`• Enemy starts +${effect.startCombatVulnerable * 25}% incoming damage`);
  if (effect.startCombatWeak)      lines.push(`• Enemy starts -${effect.startCombatWeak * 25}% attack damage`);
  if (effect.onCombatStart) {
    const oc = effect.onCombatStart;
    if (oc.block)  lines.push(`• +${oc.block} Block at the start of every combat`);
    if (oc.draw)   lines.push(`• +${oc.draw} cards drawn on turn 1`);
    if (oc.energy) lines.push(`• +${oc.energy} Energy on turn 1`);
    if (oc.hp)     lines.push(`• +${oc.hp} HP at the start of every combat`);
  }
  return lines.join('\n');
}

export function relicEffectSummary(relic) {
  const e = relic?.effect || {};
  const lines = [];
  if (e.passiveStrikeBonus)        lines.push(`• +${e.passiveStrikeBonus} dmg to any Effect named "Strike"`);
  if (e.permanentEnergyBonus)      lines.push(`• +${e.permanentEnergyBonus} Energy every turn (permanent)`);
  if (e.onCombatStart) {
    const oc = e.onCombatStart;
    if (oc.block)  lines.push(`• +${oc.block} Block at the start of every combat`);
    if (oc.draw)   lines.push(`• +${oc.draw} cards drawn on turn 1 of every combat`);
    if (oc.energy) lines.push(`• +${oc.energy} Energy on turn 1 of every combat`);
    if (oc.hp)     lines.push(`• +${oc.hp} HP at the start of every combat`);
  }
  if (e.onEnemyDefeated) {
    const od = e.onEnemyDefeated;
    if (od.heal)   lines.push(`• +${od.heal} HP each time you defeat an enemy`);
    if (od.draw)   lines.push(`• Draw ${od.draw} when you defeat an enemy`);
    if (od.energy) lines.push(`• +${od.energy} Energy when you defeat an enemy`);
  }
  if (e.onCombatEnd) {
    const ce = e.onCombatEnd;
    if (ce.heal)   lines.push(`• +${ce.heal} HP at the end of every combat won`);
  }
  if (e.everyNthEffect) {
    const en = e.everyNthEffect;
    lines.push(`• Every ${en.n}th Effect you cast deals +${en.extraDamage} damage`);
  }
  return lines.join('\n');
}

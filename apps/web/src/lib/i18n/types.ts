export type Locale = 'en' | 'ru';

export interface Translations {
  // App
  app_name: string;

  // Header
  header_active: string;
  header_players: string;
  header_tension_stable: string;
  header_tension_elevated: string;
  header_tension_critical: string;
  header_tick: string;
  header_pause: string;
  header_resume: string;

  // Session
  session_create: string;
  session_new: string;
  session_name: string;
  session_name_placeholder: string;
  session_your_name: string;
  session_your_name_placeholder: string;
  session_creating: string;
  session_select_country: string;
  session_ready: string;
  session_ready_desc: string;
  session_start: string;
  session_starting: string;
  session_fill_fields: string;

  // AI
  ai_opponents: string;
  ai_difficulty: string;
  ai_easy: string;
  ai_easy_desc: string;
  ai_normal: string;
  ai_normal_desc: string;
  ai_hard: string;
  ai_hard_desc: string;

  // Country panel
  panel_select_country: string;
  panel_click_globe: string;
  panel_power_index: string;
  panel_gdp: string;
  panel_military: string;
  panel_stability: string;
  panel_stability_critical: string;
  panel_tech_level: string;
  panel_population: string;
  panel_gdp_growth: string;
  panel_non_playable: string;
  panel_non_playable_desc: string;

  // Tabs
  tab_economy: string;
  tab_military: string;
  tab_diplomacy: string;
  tab_intelligence: string;
  tab_research: string;
  tab_domestic: string;

  // Diplomacy
  diplo_influence: string;
  diplo_target: string;
  diplo_actions: string;
  diplo_propose_alliance: string;
  diplo_declare_war: string;
  diplo_sanctions: string;
  diplo_trade: string;
  diplo_active_relations: string;
  diplo_no_relations: string;
  diplo_propose_peace: string;

  // Relations
  rel_alliance: string;
  rel_war: string;
  rel_trade: string;
  rel_sanction: string;
  rel_nap: string;
  rel_ceasefire: string;
  rel_blockade: string;
  rel_smuggle: string;
  rel_wars: string;
  rel_allies: string;
  rel_global: string;
  rel_show_global: string;
  rel_show_mine: string;
  rel_pending: string;
  rel_all: string;

  // Economy
  econ_gdp: string;
  econ_growth: string;
  econ_budget: string;
  econ_tax_rate: string;
  econ_inflation: string;
  econ_trade_balance: string;
  econ_set_tax: string;
  econ_resources: string;
  econ_surplus: string;
  econ_deficit: string;

  // Military
  mil_army: string;
  mil_navy: string;
  mil_airforce: string;
  mil_nukes: string;
  mil_defense_budget: string;
  mil_create_army: string;
  mil_airstrike: string;
  mil_invasion: string;
  mil_blockade: string;

  // Intelligence
  intel_budget: string;
  intel_counter: string;
  intel_launch_op: string;
  intel_boost_counter: string;
  intel_disinfo: string;
  intel_dossiers: string;

  // Research
  research_active: string;
  research_completed: string;
  research_available: string;
  research_locked: string;
  research_cancel: string;
  research_start: string;
  research_ticks: string;
  research_cost: string;

  // Events
  events_title: string;
  events_no_events: string;

  // Misc
  connected: string;
  disconnected: string;
  click_country: string;
  create_game: string;
  language: string;
  select_language: string;

  // Victory
  victory_domination: string;
  victory_economic: string;
  victory_diplomatic: string;
  victory_technological: string;
  victory_survival: string;
  victory_title: string;
  victory_achieved: string;

  // Leaderboard
  leaderboard_title: string;
  leaderboard_rank: string;
  leaderboard_country: string;
  leaderboard_power: string;
  leaderboard_gdp: string;
  leaderboard_military: string;
}

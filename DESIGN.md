# Conflict.Game — Design Document

## Core Philosophy
Максимально реальное отражение геополитики. Не "соевая" игра — каждая механика имеет реальный референс.
1 тик = 1 месяц. Стартовый год: 2000-е (историческая база для моделирования).
У каждой страны — уникальные особенности (traits), отражающие реальную специфику.

---

## Roadmap: Версии и релизы

### v0.1 — Alpha: Core Loop (DONE)
- [x] Монорепо (Turborepo), shared types, game-logic, utils
- [x] 30 стран с реалистичными параметрами (seed data)
- [x] Сервер: Fastify + WebSocket + in-memory state
- [x] Game loop: 10-сек тик, economy/stability/power tick
- [x] REST API: lobby, sessions, country selection
- [x] Web: 3D глобус (react-globe.gl), сворачиваемые панели
- [x] 25+ действий: санкции, вторжения, бомбардировки, кибератаки, пропаганда, перевороты, arms deals
- [x] Sanctions resilience + evasion system (теневой флот, крипта, параллельный импорт)
- [x] Sanctions blowback on sanctioner (нефтяной шок, инфляция)
- [x] War declaration perks (мобилизация, военная экономика, rally-around-flag)
- [x] Toast-уведомления о результатах действий
- [x] Тиковый календарь (месяцы/годы)

### v0.2 — Alpha: Resource Dependency & Supply Chains
- [ ] `resourceDependencies: Record<resource, string[]>` — кто от кого зависит
- [ ] Санкции/война с поставщиком → дефицит ресурса → экономический шок
- [ ] Альтернативные поставщики (дороже, время на переключение)
- [ ] Торговые маршруты на глобусе (визуализация линиями)
- [ ] OPEC-подобные организации (коллективное управление ценами на нефть)
- [ ] Taiwan semiconductor scenario: один поставщик = критическая зависимость
- [ ] Визуализация ресурсных потоков на глобусе

### v0.3 — Alpha: Fog of War & Intelligence
- [ ] Чужие данные — оценки с погрешностью ±10-30%
- [ ] Шпионаж раскрывает реальные данные (бюджет + риск поимки)
- [ ] Контрразведка снижает точность чужого шпионажа
- [ ] Disinformation: фейковые данные о себе (армия выглядит больше/меньше)
- [ ] SIGINT (tech 7+): перехват коммуникаций, предпросмотр вражеских действий
- [ ] "Разведка" вкладка с данными и досье на страны

### v0.4 — Beta: Tech Tree & Weapons Market
- [ ] 4 ветки: Military, Cyber, Economy, Intelligence
- [ ] Конкретные системы вооружений: Patriot, S-400, Iron Dome, HIMARS, Bayraktar
- [ ] Arms market: купить у производителя или разработать самому
- [ ] Экспортные ограничения (US не продаёт S-400)
- [ ] Tech prerequisites: гиперзвук требует ракеты + мат. наука
- [ ] Визуальное дерево технологий в UI

### v0.5 — Beta: Financial Warfare
- [ ] `freeze_assets` — заморозка части бюджета (требует финансовое доминирование)
- [ ] `swift_disconnect` — отключение от SWIFT (катастрофа для торговли)
- [ ] `imf_leverage` — МВФ кредит с условиями (approval hit)
- [ ] Вторичные санкции: наказать посредников
- [ ] Офшоры и отмывание (counter-mechanic)

### v0.6 — Beta: Domestic Politics
- [ ] Выборы: демократии каждые 4-5 лет, автократии — переворот при low approval
- [ ] Фракции: военные, олигархи, народ, религиозные
- [ ] Протесты при approval < 25% → подавить или уступить
- [ ] Уникальные traits стран (см. ниже)
- [ ] Мобилизация населения в военное время

### v0.7 — Beta: Alliance Depth
- [ ] Military alliance (Article 5 — коллективная оборона)
- [ ] Economic union (зона свободной торговли)
- [ ] Intelligence sharing (Five Eyes)
- [ ] Предательство: выход из альянса (ref: Армения из ОДКБ)
- [ ] Условия вступления, голосования, вето

### v0.8 — Release Candidate: Polish & Balance
- [ ] Балансировка всех 30 стран
- [ ] AI-противники для пустых слотов
- [ ] Tutorials / onboarding
- [ ] Performance: delta-compression WS, render optimization
- [ ] Sound effects, анимации
- [ ] Mobile (Expo): адаптация UI + react-native-maps

### v1.0 — Release
- [ ] Все core системы отполированы
- [ ] Мультиплеер протестирован (10+ одновременных игроков)
- [ ] Документация для игроков
- [ ] Деплой (VPS/Cloud)

---

## Post-Release Updates

### v1.1 — War Map (Feature Patch)
- Отдельная "карта войны" при клике на конфликт
- Фронтовая линия, движение армий, ракетные удары
- Типы армий с контрмерами (ПВО vs авиация)
- Логистика: далёкая война = дороже
- Партизанская война: оккупация стоит budget/тик
- MAD: ядерка у обоих = взаимное уничтожение

### v1.2 — Extended Map (195 стран)
- Расширение с 30 до 195 стран
- Авто-генерация параметров на основе реальных данных
- AI управляет неигровыми странами

### v1.3 — Historical Scenarios
- Стартовый год 2000: Cold War aftermath
- Scenario: Ирак 2003, Арабская весна 2011, Крым 2014, COVID-2020
- Исторические события как triggers

---

## DLC

### DLC #1: "DeepState" — Государство в государстве
**Роль:** Теневой оператор — не управляешь страной, а влияешь изнутри.

Механики:
- ЧВК (частные военные компании): наёмные армии, "серые зоны"
- Компромат / "Файлы Эпштейна": досье на лидеров → шантаж
- Фальсификации: fake news, провокации, "под чужим флагом"
- Теневая экономика: офшоры, чёрный рынок оружия
- Невидимость: обычные игроки видят только последствия

Победные условия:
- Кукловод: контроль 5+ правительств через компромат
- Хаос-архитектор: 10+ конфликтов между другими игроками
- Теневая империя: 30% мировой теневой экономики

### DLC #2: "We Are The People" — Голос народа
**Роль:** Лидер повстанческого движения внутри чужой страны.

Механики:
- Протесты → забастовки → восстания
- Партизанская война: guerrilla, саботаж
- Пропаганда снизу: соцсети, подпольные медиа
- Мировое внимание: международное давление на режим
- Революция: свержение правительства
- Фракции внутри движения (радикалы vs умеренные)

Победные условия:
- Революция: свержение и новый режим
- Автономия: независимость региона
- Реформы: все требования без свержения

---

## Уникальные traits стран

Каждая страна имеет 1-3 уникальных trait, отражающих реальную специфику:

| Страна | Traits |
|--------|--------|
| US | `reserve_currency` (доллар = финансовое оружие), `military_industrial_complex` (дешевле оружие), `global_reach` (базы по миру) |
| CN | `factory_of_the_world` (производство дешевле), `great_firewall` (иммунитет к пропаганде), `belt_and_road` (дип. влияние через инфраструктуру) |
| RU | `resource_superpower` (нефть/газ как рычаг), `nuclear_parity` (MAD), `hybrid_warfare` (дешевле covert ops) |
| DE | `industrial_engine` (GDP бонус), `eu_leader` (дип. влияние в Европе), `energy_dependent` (уязвимость) |
| JP | `tech_powerhouse` (R&D дешевле), `pacifist_constitution` (ограничение армии, бонус дипломатии) |
| IN | `demographic_dividend` (рост населения = рост GDP), `non_aligned` (нет penalty за торговлю с обеими сторонами) |
| IL | `iron_dome` (ПВО бонус), `mossad` (разведка +30%), `small_but_mighty` (качество > количество армии) |
| IR | `proxy_network` (дешевле proxy wars), `sanctions_veteran` (высокая resilience), `nuclear_ambition` (ядерная программа) |
| KP | `juche` (полная автаркия, иммунитет к санкциям, GDP penalty), `nuclear_blackmail` (ядерный шантаж) |
| SA | `oil_kingdom` (контроль цен через OPEC), `petrodollar` (привязка к доллару) |
| TR | `gateway` (контроль проливов = торговый рычаг), `neo_ottoman` (дип. влияние в регионе) |
| UA | `breadbasket` (зерно = торговый рычаг), `resilient_society` (бонус stability в войне) |
| BR | `amazon_leverage` (экологический рычаг), `regional_hegemon` (влияние в Латинской Америке) |
| AU | `resource_rich` (металлы, уголь), `five_eyes` (разведка sharing), `island_fortress` (оборона) |
| GB | `financial_center` (Лондон = финансовое влияние), `five_eyes`, `nuclear_power` |
| FR | `nuclear_power`, `un_veto`, `francophone` (влияние в Африке) |
| EG | `suez_control` (торговый рычаг), `arab_leader` (дип. влияние) |
| NG | `oil_producer`, `demographic_giant` (крупнейшая в Африке) |
| PK | `nuclear_power`, `strategic_depth` (буфер Афганистан), `instability` (penalty stability) |

---

## Текущие механики (реализовано)

### Sanctions System
- `sanctionResilience: 0-100` — устойчивость экономики
- `sanctionEvasion: 0-100` — обход санкций (растёт со временем +0.3/тик)
- Давление нарастает: `durationFactor = min(1, duration/12)` (полный эффект через 12 мес)
- GDP-weighted: крупная экономика = больнее санкции
- Blowback на санкционера: потеря торговли, инфляция, энергетический шок (если цель = нефтегаз)
- `effectivePressure = totalPressure * (1 - resilience*0.5) * (1 - evasion*0.4)`

### Evasion Actions
- `shadow_fleet` — $5B, evasion +15
- `crypto_bypass` — $3B, evasion +10
- `parallel_import` — $8B, evasion +20, resilience +5
- `import_substitution` — $20B, evasion +10, resilience +15

### Military Operations (no war required)
- `airstrike` — surgical ($2B) / conventional ($8B) / carpet ($20B)
- `invasion` — battle resolution: attack power vs defense (30% bonus)
- `naval_blockade` — trade strangulation ($5B)
- Without war declaration: -25 influence, -15 approval penalty

### War Declaration Perks
- Army +15% mobilization
- Defense budget +20%
- GDP growth +0.5% (war stimulus)
- Approval +5 (rally-around-flag)

### Covert Operations
- `proxy_war` — fund rebels (30% exposure chance)
- `incite_rebellion` — destabilize via stability
- `sabotage` — 4 targets (infrastructure/military/energy/communications)
- `cyber_attack` — 4 targets (government/financial/military/infrastructure)
- `coup_attempt` — success based on target stability/approval
- `propaganda` — 4 narratives
- `false_flag` — frame third country (believability based on tech difference)

---

## Implementation Order (updated)
1. **[DONE] v0.1** — Core loop + 25 actions + sanctions
2. **[NEXT] v0.2** — Resource dependency & supply chains
3. **v0.3** — Fog of war
4. **v0.4** — Tech tree + weapons market
5. **v0.5** — Financial warfare
6. **v0.6** — Domestic politics + country traits
7. **v0.7** — Alliance depth
8. **v0.8** — Polish & balance
9. **v1.0** — Release
10. **v1.1** — War map (feature patch)
11. **v1.2** — 195 стран
12. **v1.3** — Historical scenarios

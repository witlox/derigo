# Derigo

[![CI](https://github.com/witlox/derigo/actions/workflows/ci.yml/badge.svg)](https://github.com/witlox/derigo/actions/workflows/ci.yml)
[![CodeQL](https://github.com/witlox/derigo/actions/workflows/codeql.yml/badge.svg)](https://github.com/witlox/derigo/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/witlox/derigo/branch/main/graph/badge.svg)](https://codecov.io/gh/witlox/derigo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A browser extension that analyzes web content for political alignment, truthfulness, and author authenticity, giving you control over what you consume.

## What is Derigo?

Derigo performs dual analysis of web content:
1. **Content Classification**: Political alignment and truthfulness of the content itself
2. **Author Classification**: Authenticity and intent of the author (detecting bots, trolls, state-sponsored actors)

Results are displayed in a 7-axis radar chart. You can set filters to warn or block content based on political alignment, truthfulness, and author credibility.

```
        7-Axis Radar Chart

           Economic
              /\
    Social   /  \   Authority
            /    \
           / Auth \
          /   ●    \
         /    |     \
        /     |      \
   Truth ─────┼────── Organic
        \     |      /
         \    |     /
          \   |    /
           \  |   /
            Global

    Content Axes: Economic, Social, Authority, Globalism
    Author Axes: Authenticity, Coordination (Organic)
    Quality Axis: Truthfulness
```

## Features

- **Multi-dimensional content analysis**: Content scored on 4 political axes, not just left/right
- **Author classification (NEW)**: Detect bots, trolls, state-sponsored actors, and commercial spam
- **Truthfulness scoring**: Rates content credibility using source reputation and fact-check data
- **7-axis radar chart**: See content AND author profiles at a glance
- **Configurable filtering**: Block, warn, or badge based on content, author, or both
- **Privacy-first**: All analysis happens locally by default
- **Fast and lightweight**: <50ms classification, minimal memory footprint

## Content Axes (Political)

| Axis | Left/Low (-100) | Right/High (+100) |
|------|-----------------|-------------------|
| **Economic** | Collectivist, regulation, redistribution | Free market, deregulation, privatization |
| **Social** | Progressive, reform, change | Conservative, traditional, stability |
| **Authority** | Libertarian, individual freedom | Authoritarian, state control, security |
| **Globalism** | Nationalist, sovereignty, borders | Globalist, international cooperation |

## Author Axes (NEW)

| Axis | Low (0) | High (100) |
|------|---------|------------|
| **Authenticity** | Bot-like, automated | Human, genuine |
| **Coordination** | Orchestrated, part of campaign | Organic, independent |

### Author Intent Categories

| Category | Description | Indicators |
|----------|-------------|------------|
| **Organic** | Genuine personal/organizational expression | Personal voice, nuanced arguments |
| **Troll** | Provocative, disruptive intent | Inflammatory language, personal attacks |
| **Bot** | Automated spam/amplification | Repetitive content, templated phrases |
| **State-sponsored** | Government-affiliated disinformation | Coordinated narratives, foreign policy alignment |
| **Commercial** | Marketing/promotional content | Affiliate links, promotional language |
| **Activist** | Organized advocacy campaigns | Consistent messaging, hashtag coordination |

Each content axis scores from -100 to +100. Author axes score from 0 to 100. The 7-axis radar chart displays all dimensions simultaneously.

## Truthfulness Score

Content receives a 0-100 truthfulness rating based on:

- **Source reputation**: Known credibility of the domain
- **Fact-check matches**: Claims verified against fact-check databases
- **Content signals**: Clickbait patterns, emotional language, citation quality

| Score | Rating |
|-------|--------|
| 80-100 | Highly credible |
| 60-79 | Generally reliable |
| 40-59 | Mixed/unverified |
| 0-39 | High misinformation risk |

## Installation

### Chrome / Brave

1. Download the latest release from [Releases](https://github.com/witlox/derigo/releases)
2. Unzip to a folder
3. Go to `chrome://extensions`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the folder

### Firefox (coming soon)

### Safari (planned)

## Usage

### Viewing Analysis

Click the Derigo icon in your browser toolbar to see the current page's analysis:

```
┌─────────────────────────────────┐
│  Derigo                    ● On │
├─────────────────────────────────┤
│                                 │
│        [Radar Chart]            │
│     Economic ──── Social        │
│         \          /            │
│          \   ●    /             │
│           \  |   /              │
│     Auth ──────── Global        │
│                                 │
├─────────────────────────────────┤
│  Truthfulness: ████████░░ 78%   │
│  Confidence:   High             │
├─────────────────────────────────┤
│  [Settings]              v1.0.0 │
└─────────────────────────────────┘
```

### Setting Filters

In Settings, configure your preferences:

**Content filters** (optional):
- Set acceptable ranges for each political axis using sliders
- Content outside your ranges triggers the selected display mode

**Author filters** (NEW):
- Set minimum authenticity threshold (0-100)
- Set maximum coordination threshold (0-100)
- Block specific author types: Bots, Trolls, State-sponsored, Commercial, Activist

**Truthfulness threshold**:
- Set minimum truthfulness score (0-100)
- Content below threshold triggers warning/block

**Display modes**:
- **Badge**: Non-intrusive corner indicator (default)
- **Overlay**: Dismissible warning, can proceed
- **Block**: Full page block, must acknowledge to view
- **Off**: Analysis only, no visual indication

### Example Configurations

**"Show me everything, just label it"**:
- All content filters: disabled
- All author filters: disabled
- Truthfulness threshold: 0
- Display mode: Badge

**"Warn me about unreliable content"**:
- All content filters: disabled
- Truthfulness threshold: 60
- Display mode: Overlay

**"Filter out bots and trolls"** (NEW):
- All content filters: disabled
- Minimum authenticity: 50
- Block intents: Bot, Troll
- Display mode: Overlay

**"Avoid extreme content"**:
- Economic: -70 to +70
- Social: -70 to +70
- Authority: -70 to +70
- Globalism: -70 to +70
- Truthfulness threshold: 40
- Display mode: Overlay

**"Block misinformation and state-sponsored content"** (NEW):
- Truthfulness threshold: 70
- Minimum authenticity: 40
- Maximum coordination: 60
- Block intents: Bot, State-sponsored
- Display mode: Block

**"Filter out misinformation"**:
- All content filters: disabled
- Truthfulness threshold: 70
- Display mode: Block

## How It Works

### Classification Pipeline

```
Page Load
    │
    ▼
┌─────────────────┐
│ Extract Content │ ← Headlines, body text, metadata
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│Content │ │  Author    │ ← Extract username, byline,
│Analysis│ │ Extraction │   social media embeds
└───┬────┘ └─────┬──────┘
    │            │
    ▼            ▼
┌────────┐ ┌────────────┐
│Keyword │ │ Heuristic  │ ← Bot patterns, troll signals,
│Scoring │ │  Analysis  │   content originality
└───┬────┘ └─────┬──────┘
    │            │
    ▼            ▼
┌────────┐ ┌────────────┐
│Source  │ │Known Actor │ ← Check bundled database
│Lookup  │ │  Lookup    │   of bots/trolls/state actors
└───┬────┘ └─────┬──────┘
    │            │
    └────┬───────┘
         │
         ▼
┌─────────────────┐
│ Combine Scores  │ ← Content + Author + Truth scores
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Apply Filters   │ ← Check against user preferences
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Display Result  │ ← 7-axis radar chart + author badge
└─────────────────┘
```

### Performance

- **Local-first**: Core classification runs entirely in-browser
- **Fast**: <50ms for most pages
- **Cached**: Results stored for 24 hours
- **Lightweight**: <100KB extension size, <50MB memory

### Optional Enhanced Analysis

Enable in settings to use external APIs for improved accuracy:
- Fact-check API queries for specific claims
- AI-powered content and author analysis (requires API key)
- Bot Sentinel integration for Twitter/X account verification
- Known actor database lookups for state-sponsored detection

## Privacy

- No data collection or tracking
- All analysis happens locally by default
- Optional API features are opt-in and require your own keys
- Only URL hashes are cached, not page content
- Open source for full transparency

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
git clone https://github.com/witlox/derigo.git
cd derigo
npm install
```

### Commands

```bash
npm run dev       # Development build with watch
npm run build     # Production build
npm run test      # Run test suite
npm run lint      # Run linter
npm run package   # Create distributable zip
```

### Project Structure

```
derigo/
├── src/
│   ├── background/     # Service worker
│   ├── content/        # Content script, display modes
│   ├── popup/          # Toolbar popup UI
│   ├── options/        # Settings page
│   └── lib/            # Shared libraries (content + author classifiers)
├── data/
│   ├── keywords.json   # Weighted keyword database
│   ├── sources.json    # Source reputation database
│   └── known-actors.json # Known bots/trolls/state actors (NEW)
├── tests/
└── dist/               # Built extension
```

### Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

Quick start:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Roadmap

- [x] Core content classification engine
- [x] Chrome/Brave support
- [x] 4-axis radar chart visualization
- [x] Author classification (bot/troll/state-sponsored detection)
- [x] 7-axis radar chart with author axes
- [x] Known actor database
- [x] Site profiles for per-domain customization
- [ ] Firefox support
- [ ] Safari/iOS support
- [ ] Fact-check API integration
- [ ] Bot Sentinel integration
- [ ] Community source ratings
- [ ] Browser history analysis

## FAQ

**Does this track my browsing?**
No. All analysis is local. Nothing is sent anywhere unless you explicitly enable optional API features.

**How accurate is the classification?**
Classification accuracy depends on content type. News articles from known sources are highly accurate. User-generated content and new sources have lower confidence.

**Can I add my own keywords or sources?**
Not currently, but planned for a future release.

**Why a radar chart?**
Politics is multi-dimensional. A simple left/right scale misses important distinctions. The radar chart shows economic, social, authority, and globalism axes simultaneously.

**Does this work on social media?**
Yes, and this is where author classification is most powerful. The extension can extract author information from Twitter/X embeds, Reddit posts, and other platforms to analyze the author's authenticity and intent.

**How does author detection work?**
Author classification uses heuristics (posting patterns, language analysis, content originality) combined with optional external database lookups. A bundled database of known bots/trolls/state-actors is included. All detection happens locally by default.

**What about false positives?**
Author classification shows confidence levels. Low-confidence classifications are clearly marked. You can adjust sensitivity thresholds in settings. The system errs on the side of caution to avoid incorrectly flagging genuine users.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Source reputation data aggregated from public bias ratings
- Fact-check integration via Google Fact Check Tools API
- Built with the Chrome Extensions Manifest V3 API

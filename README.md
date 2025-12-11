# Derigo

A browser extension that analyzes web content for political alignment and truthfulness, giving you control over what you consume.

## What is Derigo?

Derigo scans web pages and classifies them across multiple political dimensions, displaying the results as a radar chart. You can set filters to warn or block content based on political alignment and minimum truthfulness scores.

```
                    Authoritarian
                         ▲
                        /|\
                       / | \
                      /  |  \
           Left ◄────●───┼───────► Right
                      \  |  /
                       \ | /
                        \|/
                         ▼
                    Libertarian

        + Globalist ←──────→ Nationalist axis
        + Progressive ←────→ Conservative axis
```

## Features

- **Multi-dimensional analysis**: Content is scored on 4 political axes, not just left/right
- **Truthfulness scoring**: Rates content credibility using source reputation and fact-check data
- **Radar chart visualization**: See the political profile of any page at a glance
- **Configurable filtering**: Block, warn, or badge content based on your preferences
- **Privacy-first**: All analysis happens locally by default
- **Fast and lightweight**: <50ms classification, minimal memory footprint

## Political Axes

| Axis | Left/Low | Right/High |
|------|----------|------------|
| **Economic** | Collectivist, regulation, redistribution | Free market, deregulation, privatization |
| **Social** | Progressive, reform, change | Conservative, traditional, stability |
| **Authority** | Libertarian, individual freedom | Authoritarian, state control, security |
| **Globalism** | Nationalist, sovereignty, borders | Globalist, international cooperation |

Each axis scores from -100 to +100. The radar chart displays all four axes simultaneously.

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

1. Download the latest release from [Releases](https://github.com/user/derigo/releases)
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

**Political filters** (optional):
- Set acceptable ranges for each axis using sliders
- Content outside your ranges triggers the selected display mode

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
- All political filters: disabled
- Truthfulness threshold: 0
- Display mode: Badge

**"Warn me about unreliable content"**:
- All political filters: disabled
- Truthfulness threshold: 60
- Display mode: Overlay

**"Avoid extreme content"**:
- Economic: -70 to +70
- Social: -70 to +70
- Authority: -70 to +70
- Globalism: -70 to +70
- Truthfulness threshold: 40
- Display mode: Overlay

**"Filter out misinformation"**:
- All political filters: disabled
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
         ▼
┌─────────────────┐
│ Source Lookup   │ ← Check domain reputation database
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Keyword Scoring │ ← Match against weighted term database
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Combine Scores  │ ← Weighted average of signals
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Apply Filters   │ ← Check against user preferences
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Display Result  │ ← Badge, overlay, or block
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
- AI-powered nuanced analysis (requires API key)

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
git clone https://github.com/user/derigo.git
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
│   └── lib/            # Shared libraries
├── data/
│   ├── keywords.json   # Weighted keyword database
│   └── sources.json    # Source reputation database
├── tests/
└── dist/               # Built extension
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Roadmap

- [x] Core classification engine
- [x] Chrome/Brave support
- [ ] Radar chart visualization
- [ ] Firefox support
- [ ] Safari/iOS support
- [ ] Fact-check API integration
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
Yes, but with lower confidence. Social media content is shorter and more varied. The extension analyzes visible content on any page.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Source reputation data aggregated from public bias ratings
- Fact-check integration via Google Fact Check Tools API
- Built with the Chrome Extensions Manifest V3 API

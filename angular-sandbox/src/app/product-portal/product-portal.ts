import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var Tracker: any;

@Component({
  selector: 'app-product-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-portal.html',
  styleUrl: './product-portal.css'
})
export class ProductPortal implements OnInit {
  activeTab: string = 'dashboard';

  // Dashboard state
  timeframe: string = '1D';
  gridlines: boolean = true;
  selectedAccount: string = 'Primary';

  // Running Ticker state
  searchSymbol: string = '';
  activeTicker: string = 'AAPL';
  tickerData: any = {
    'AAPL': { price: 175.40, change: '+1.25%', volume: '1.2M' },
    'MSFT': { price: 420.55, change: '+0.85%', volume: '950K' },
    'TSLA': { price: 180.20, change: '-2.10%', volume: '3.1M' },
    'NVDA': { price: 925.00, change: '+4.50%', volume: '5.2M' }
  };
  chartStyle: string = 'Candlestick';
  resolution: string = '5m';
  indicators: any = {
    rsi: false,
    macd: false,
    bands: false
  };
  multisignalActive: boolean = false;

  // Trades state
  watchlist: string[] = ['AAPL', 'TSLA', 'MSFT', 'NVDA'];
  newWatchlistSymbol: string = '';
  positionType: string = 'Long';
  tradeSymbol: string = 'AAPL';
  tradeQty: number = 10;
  tradePriceType: string = 'Limit';
  tradeMessage: string = '';

  // Pivots state
  expandedSection: string = '';
  pivotCalculationType: string = 'Standard';

  // CPI state
  cpiRegion: string = 'All Regions';
  cpiDataGranularity: string = 'Monthly';
  cpiExpandedSection: string = '';

  // Candlestick state
  candlestickPattern: string = 'All';
  chatMessages: string[] = ['System: Connected to Analyst Chat. Type a question to begin.'];
  newChatMessage: string = '';
  chatOpen: boolean = false;

  ngOnInit() {
    // Initial page view event
    this.trackPageView('dashboard');
  }

  selectTab(tab: string) {
    this.activeTab = tab;
    this.trackPageView(tab);
  }

  private trackPageView(tabName: string) {
    if (typeof Tracker !== 'undefined') {
      const formattedName = tabName.charAt(0).toUpperCase() + tabName.slice(1);
      Tracker.track('page_visited', `User navigated to: /portal/${tabName}`, {
        category_a: true
      });
    }
  }

  // Dashboard Actions
  setTimeframe(tf: string) {
    this.timeframe = tf;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('filter_changed', `Dashboard: Selected timeframe: ${tf}`, {
        category_b: true
      }, 'select-timeframe');
    }
  }

  toggleGridlines() {
    this.gridlines = !this.gridlines;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('chart_interaction', `Dashboard: Toggled chart gridlines to: ${this.gridlines}`, {
        category_b: true
      }, 'btn-toggle-gridlines');
    }
  }

  changeAccount(event: any) {
    const acc = event.target.value;
    this.selectedAccount = acc;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('filter_changed', `Dashboard: Switched active account to: ${acc}`, {
        category_a: true
      }, 'select-account-portfolio');
    }
  }

  // Running Ticker Actions
  searchTicker() {
    const symbol = this.searchSymbol.toUpperCase().trim();
    if (symbol) {
      if (this.tickerData[symbol]) {
        this.activeTicker = symbol;
      } else {
        // Mock new symbol addition on-the-fly
        this.tickerData[symbol] = {
          price: Math.round((Math.random() * 500 + 50) * 100) / 100,
          change: (Math.random() > 0.4 ? '+' : '-') + (Math.round(Math.random() * 5 * 100) / 100) + '%',
          volume: Math.round(Math.random() * 5 + 1) + 'M'
        };
        this.activeTicker = symbol;
      }
      this.tradeSymbol = symbol; // Sync with trades input
      
      if (typeof Tracker !== 'undefined') {
        Tracker.track('filter_changed', `Running Ticker: Searched for ticker symbol: ${symbol}`, {
          category_b: true
        }, 'input-ticker-search');
      }
    }
    this.searchSymbol = '';
  }

  setChartStyle(style: string) {
    this.chartStyle = style;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('chart_interaction', `Running Ticker: Changed chart style to: ${style}`, {
        category_b: true
      }, 'toggle-chart-style');
    }
  }

  setResolution(res: string) {
    this.resolution = res;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('filter_changed', `Running Ticker: Changed resolution to: ${res}`, {
        category_b: true
      }, 'select-ticker-resolution');
    }
  }

  toggleIndicator(ind: string) {
    this.indicators[ind] = !this.indicators[ind];
    if (typeof Tracker !== 'undefined') {
      Tracker.track('toggle_interaction', `Running Ticker: Toggled technical indicator ${ind.toUpperCase()} to: ${this.indicators[ind]}`, {
        category_c: true
      }, `chk-indicator-${ind}`);
    }
  }

  // Trades Actions
  addToWatchlist() {
    const symbol = this.newWatchlistSymbol.toUpperCase().trim();
    if (symbol && !this.watchlist.includes(symbol)) {
      this.watchlist.push(symbol);
      if (typeof Tracker !== 'undefined') {
        Tracker.track('watchlist_added', `Trades: Added ${symbol} to watchlist`, {
          category_b: true
        }, 'btn-watchlist-add');
      }
    }
    this.newWatchlistSymbol = '';
  }

  togglePositionType(type: string) {
    this.positionType = type;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('view_toggled', `Trades: Toggled position type view to: ${type}`, {
        category_b: true
      }, 'toggle-trade-position');
    }
  }

  submitOrder() {
    if (this.tradeSymbol && this.tradeQty > 0) {
      const action = this.positionType === 'Long' ? 'Buy' : 'Sell Short';
      this.tradeMessage = `Successfully submitted ${this.tradePriceType} order: ${action} ${this.tradeQty} shares of ${this.tradeSymbol.toUpperCase()}`;
      
      if (typeof Tracker !== 'undefined') {
        Tracker.track('trade_initiated', `Trades: Executed ${this.tradePriceType} ${action} of ${this.tradeQty} shares of ${this.tradeSymbol.toUpperCase()}`, {
          category_b: true
        }, 'btn-submit-order');
      }

      setTimeout(() => {
        this.tradeMessage = '';
      }, 5000);
    }
  }

  openPositionDetails() {
    if (typeof Tracker !== 'undefined') {
      Tracker.track('element_clicked', 'Trades: Opened position details', {
        category_a: true
      }, 'btn-position-details');
    }
    alert('Positions: Open Long AAPL (10 shares), Short TSLA (5 shares). Portfolio Risk Level: MODERATE.');
  }

  // Pivots Actions
  toggleAccordion(section: string) {
    if (this.expandedSection === section) {
      this.expandedSection = '';
    } else {
      this.expandedSection = section;
      if (typeof Tracker !== 'undefined') {
        Tracker.track('section_expanded', `Pivots: Expanded support/resistance detail section: ${section}`, {
          category_c: true
        }, `panel-expand-${section.toLowerCase()}`);
      }
    }
  }

  changePivotCalc(calc: string) {
    this.pivotCalculationType = calc;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('toggle_interaction', `Pivots: Changed pivot calculation to ${calc}`, {
        category_b: true
      }, 'toggle-pivot-calc');
    }
  }

  exportPivots() {
    if (typeof Tracker !== 'undefined') {
      Tracker.track('element_clicked', 'Pivots: Exported pivot levels sheet to CSV', {
        category_c: true
      }, 'btn-export-pivots-sheet');
    }
    alert('Mock Pivot levels sheet exported successfully as CSV file!');
  }

  // Running Ticker Addition
  toggleMultisignal() {
    this.multisignalActive = !this.multisignalActive;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('toggle_interaction', `Running Ticker: Toggled Multisignal state to: ${this.multisignalActive}`, {
        category_b: true
      }, 'btn-multisignal');
    }
  }

  // CPI Actions
  changeCpiRegion(event: any) {
    const region = event.target.value;
    this.cpiRegion = region;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('filter_changed', `CPI: Changed region/year filter to: ${region}`, {
        category_b: true
      }, 'select-cpi-region');
    }
  }

  setCpiGranularity(granularity: string) {
    this.cpiDataGranularity = granularity;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('toggle_interaction', `CPI: Selected granularity chunk: ${granularity}`, {
        category_b: true
      }, `btn-cpi-chunk-${granularity.toLowerCase()}`);
    }
  }

  toggleCpiAccordion(section: string) {
    if (this.cpiExpandedSection === section) {
      this.cpiExpandedSection = '';
    } else {
      this.cpiExpandedSection = section;
      if (typeof Tracker !== 'undefined') {
        Tracker.track('section_expanded', `CPI: Expanded inflation detail section: ${section}`, {
          category_b: true
        }, `panel-expand-cpi-${section.toLowerCase()}`);
      }
    }
  }

  // Candlestick Actions
  setCandlestickPattern(pattern: string) {
    this.candlestickPattern = pattern;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('filter_changed', `Candlestick: Selected pattern filter: ${pattern}`, {
        category_b: true
      }, `btn-candle-pattern-${pattern.toLowerCase()}`);
    }
  }

  submitCandlestickTrade() {
    if (typeof Tracker !== 'undefined') {
      Tracker.track('trade_initiated', 'Candlestick: Clicked Trade Button', {
        category_b: true
      }, 'btn-candlestick-trade');
    }
    alert('Quick trade panel initiated from candlestick chart!');
  }

  toggleChat() {
    this.chatOpen = !this.chatOpen;
    if (typeof Tracker !== 'undefined') {
      Tracker.track('element_clicked', `Candlestick: Toggled Analyst Chat to: ${this.chatOpen}`, {
        category_b: true
      }, 'btn-candlestick-chat');
    }
  }

  sendChatMessage() {
    const msg = this.newChatMessage.trim();
    if (msg) {
      this.chatMessages.push(`You: ${msg}`);
      this.newChatMessage = '';
      if (typeof Tracker !== 'undefined') {
        Tracker.track('element_clicked', `Candlestick: Sent message to analyst chat`, {
          category_b: true
        }, 'btn-send-chat');
      }
      setTimeout(() => {
        this.chatMessages.push('Analyst: Thanks for your query. I am reviewing the setup.');
      }, 1500);
    }
  }
}

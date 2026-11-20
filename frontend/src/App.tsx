import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  Activity, ArrowDownLeft, ArrowUpRight, BrainCircuit, CalendarDays,
  ChartNoAxesCombined, ChevronRight, Flame, HeartPulse, Home,
  Lightbulb, LogOut, Menu, PiggyBank, Plus, ReceiptText, Search,
  Send, ShieldAlert, ShoppingBag, Sparkles, Target, Trash2,
  TrendingDown, TrendingUp, Wallet, X, Pencil, RotateCcw, Trophy
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line,
  LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import './App.css';

type Tx = {
  id: number;
  title: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
};

type Goal = {
  id: number;
  name: string;
  target: number;
  saved: number;
  created: string;
};

type Chat = {
  role: 'user' | 'assistant';
  text: string;
};

type UserAccount = {
  name: string;
  password: string;
};

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(n) ? n : 0);

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_DREAM = {
  name: '',
  price: 0,
  months: 6
};

function read<T,>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

const colors = [
  '#d71920', '#64748b', '#c49a6c', '#93a4b8',
  '#9b7b91', '#4e8b78', '#d68b63'
];

const navItems = [
  ['Overview', Home],
  ['Transactions', ReceiptText],
  ['Budget Planner', Wallet],
  ['Savings Goals', Target],
  ['Challenges', Trophy],
  ['Dream Planner', ShoppingBag],
  ['Analytics', ChartNoAxesCombined],
  ['Maison AI', BrainCircuit]
] as const;

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'auth' | 'app'>('landing');

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  const [activeUser, setActiveUser] = useState('');
  const [dataReady, setDataReady] = useState(false);

  const [page, setPage] = useState('Overview');
  const [mobile, setMobile] = useState(false);

  const [tx, setTx] = useState<Tx[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budget, setBudget] = useState(0);
  const [challengeData, setChallengeData] = useState<Record<string, number>>({});
  const [dream, setDream] = useState(DEFAULT_DREAM);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const [modal, setModal] = useState<'tx' | 'goal' | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'Food',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    date: today()
  });

  const [goalForm, setGoalForm] = useState({
    name: '',
    target: '',
    saved: '0'
  });

  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<Chat[]>([]);

  const [independence, setIndependence] = useState({
    monthlySpend: '30000',
    invested: '0',
    monthlyInvestment: '5000',
    returnRate: '10'
  });

  // Each user's information is stored under a separate email-based key.
  const userStorageKey = (email: string, section: string) =>
    `maison_v2_user_${encodeURIComponent(email.trim().toLowerCase())}_${section}`;

  // Save only after the correct user's information has been loaded.
  useEffect(() => {
    if (activeUser && dataReady) {
      localStorage.setItem(
        userStorageKey(activeUser, 'transactions'),
        JSON.stringify(tx)
      );
    }
  }, [activeUser, dataReady, tx]);

  useEffect(() => {
    if (activeUser && dataReady) {
      localStorage.setItem(
        userStorageKey(activeUser, 'goals'),
        JSON.stringify(goals)
      );
    }
  }, [activeUser, dataReady, goals]);

  useEffect(() => {
    if (activeUser && dataReady) {
      localStorage.setItem(
        userStorageKey(activeUser, 'budget'),
        JSON.stringify(budget)
      );
    }
  }, [activeUser, dataReady, budget]);

  useEffect(() => {
    if (activeUser && dataReady) {
      localStorage.setItem(
        userStorageKey(activeUser, 'challenges'),
        JSON.stringify(challengeData)
      );
    }
  }, [activeUser, dataReady, challengeData]);

  useEffect(() => {
    if (activeUser && dataReady) {
      localStorage.setItem(
        userStorageKey(activeUser, 'dream'),
        JSON.stringify(dream)
      );
    }
  }, [activeUser, dataReady, dream]);

  // Financial calculations
  const income = tx
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const expenses = tx
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const balance = income - expenses;
  const savingsRate = income > 0
    ? Math.max(0, balance / income * 100)
    : 0;

  const monthKey = today().slice(0, 7);
  const monthTx = tx.filter(t => t.date.startsWith(monthKey));

  const monthExpense = monthTx
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const monthlyBudgetPct = budget > 0
    ? Math.min(100, monthExpense / budget * 100)
    : 0;

  const categories = useMemo(() => {
    const map = new Map<string, number>();

    tx.filter(t => t.type === 'expense').forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });

    return [...map]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [tx]);

  const monthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (11 - i));

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}`;

      const rows = tx.filter(t => t.date.startsWith(key));

      return {
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        income: rows
          .filter(t => t.type === 'income')
          .reduce((s, t) => s + t.amount, 0),
        expenses: rows
          .filter(t => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0),
        saved: rows.reduce(
          (s, t) => s + (t.type === 'income' ? t.amount : -t.amount),
          0
        )
      };
    });
  }, [tx]);

  const filtered = tx
    .filter(t =>
      (filter === 'all' || t.type === filter) &&
      `${t.title} ${t.category}`.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const goalsTotal = goals.reduce((s, g) => s + g.saved, 0);

  const unusual = useMemo(() => {
    const list = tx.filter(t => t.type === 'expense');

    const average = list.length
      ? list.reduce((s, t) => s + t.amount, 0) / list.length
      : 0;

    return list
      .filter(t => average > 0 && t.amount > average * 2.5)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [tx]);

  const activeMonths = monthly.filter(m => m.expenses > 0);

  const predicted = activeMonths.length
    ? activeMonths.reduce((s, m) => s + m.expenses, 0) / activeMonths.length
    : monthExpense;

  const healthScore =
    income === 0 && expenses === 0
      ? null
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (income > 0 ? Math.min(40, savingsRate / 2) : 0) +
              (budget > 0 ? Math.max(0, 30 - monthlyBudgetPct * 0.3) : 10) +
              (unusual.length === 0 ? 15 : Math.max(0, 15 - unusual.length * 4)) +
              (balance >= 0 ? 15 : 0)
            )
          )
        );

  const roundUp = tx
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + (Math.ceil(t.amount / 100) * 100 - t.amount), 0);

  const spendByDay = useMemo(() => {
    const map = new Map<string, number>();

    tx.filter(t => t.type === 'expense').forEach(t => {
      map.set(t.date, (map.get(t.date) || 0) + t.amount);
    });

    return map;
  }, [tx]);

  const challenges = [
    {
      id: 'daily30',
      title: '30-day saving streak',
      description: 'Build consistency with a daily saving target.',
      target: 3000,
      saved: challengeData.daily30 || 0,
      unit: '₹100 per day'
    },
    {
      id: '52week',
      title: '52-week challenge',
      description: 'Save more each week as the challenge progresses.',
      target: 137800,
      saved: challengeData['52week'] || 0,
      unit: 'Week 1: ₹100, then increase by ₹100 weekly'
    },
    {
      id: 'roundup',
      title: 'Round-up savings',
      description: 'Estimate round-up savings from your expenses.',
      target: 0,
      saved: 0,
      unit: 'Calculated from your transactions'
    }
  ];

  const independenceTarget =
    Number(independence.monthlySpend) * 12 * 25;

  const monthlyInvest = Number(independence.monthlyInvestment);
  const annualRate = Number(independence.returnRate) / 100;

  const years =
    monthlyInvest > 0 && annualRate > 0
      ? Math.log(
          (
            independenceTarget * annualRate / 12 +
            monthlyInvest
          ) /
          (
            Number(independence.invested) * annualRate / 12 +
            monthlyInvest
          )
        ) / Math.log(1 + annualRate / 12) / 12
      : Infinity;

  // Authentication
  function enter(mode: 'login' | 'signup' = 'signup') {
    setAuthMode(mode);
    setAuthError('');
    setAuthNotice('');
    setScreen('auth');
  }

  function submitAuth(e: React.FormEvent) {
    e.preventDefault();

    const email = authEmail.trim().toLowerCase();

    if (!email || !authPassword.trim()) {
      setAuthError('Please enter your email and password.');
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Password must contain at least 6 characters.');
      return;
    }

    const users = read<Record<string, UserAccount>>('maison_v2_users', {});

    // SIGNUP: create the account, then return to Login.
    if (authMode === 'signup') {
      if (!authName.trim()) {
        setAuthError('Please enter your full name.');
        return;
      }

      if (users[email]) {
        setAuthError('This account already exists. Please log in.');
        return;
      }

      users[email] = {
        name: authName.trim(),
        password: authPassword
      };

      localStorage.setItem('maison_v2_users', JSON.stringify(users));

      setAuthError('');
      setAuthNotice('Account created successfully! Please log in.');
      setAuthMode('login');
      setAuthName('');
      setAuthPassword('');
      setAuthEmail(email);
      setScreen('auth');
      return;
    }

    // LOGIN: validate the credentials.
    const user = users[email];

    if (!user || user.password !== authPassword) {
      setAuthError('Incorrect email or password.');
      return;
    }

    // Load this user's data before enabling storage updates.
    setDataReady(false);

    setTx(read(userStorageKey(email, 'transactions'), []));
    setGoals(read(userStorageKey(email, 'goals'), []));
    setBudget(read(userStorageKey(email, 'budget'), 0));
    setChallengeData(read(userStorageKey(email, 'challenges'), {}));
    setDream(read(userStorageKey(email, 'dream'), DEFAULT_DREAM));

    setChat([]);
    setQuestion('');
    setQuery('');
    setFilter('all');
    setModal(null);

    setActiveUser(email);
    setDataReady(true);

    setAuthError('');
    setAuthNotice('');
    setPage('Overview');
    setScreen('app');
  }

  function logout() {
    setDataReady(false);
    setActiveUser('');

    setTx([]);
    setGoals([]);
    setBudget(0);
    setChallengeData({});
    setDream(DEFAULT_DREAM);

    setChat([]);
    setQuestion('');
    setQuery('');
    setFilter('all');

    setModal(null);
    setEditing(null);
    setPage('Overview');

    setAuthEmail('');
    setAuthPassword('');
    setAuthName('');
    setAuthError('');
    setAuthNotice('');
    setAuthMode('login');

    setScreen('auth');
  }

  // Transaction functions
  function addTransaction() {
    setEditing(null);
    setForm({
      title: '',
      category: 'Food',
      amount: '',
      type: 'expense',
      date: today()
    });
    setModal('tx');
  }

  function editTransaction(t: Tx) {
    setEditing(t.id);
    setForm({
      title: t.title,
      category: t.category,
      amount: String(t.amount),
      type: t.type,
      date: t.date
    });
    setModal('tx');
  }

  function saveTransaction(e: React.FormEvent) {
    e.preventDefault();

    const amount = Number(form.amount);

    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const row: Tx = {
      ...form,
      title: form.title.trim(),
      amount,
      id: editing ?? Date.now()
    };

    setTx(old =>
      editing === null
        ? [row, ...old]
        : old.map(t => t.id === editing ? row : t)
    );

    setModal(null);
  }

  function saveGoal(e: React.FormEvent) {
    e.preventDefault();

    const target = Number(goalForm.target);
    const saved = Number(goalForm.saved);

    if (!goalForm.name.trim() || target <= 0 || saved < 0) {
      return;
    }

    setGoals(old => [
      ...old,
      {
        id: Date.now(),
        name: goalForm.name.trim(),
        target,
        saved,
        created: today()
      }
    ]);

    setGoalForm({ name: '', target: '', saved: '0' });
    setModal(null);
  }

  function advisorAnswer(q: string) {
    const match = q.match(/₹\s*([\d,]+)/i);
    const amount = match ? Number(match[1].replace(/,/g, '')) : null;

    let answer =
      `Based on your ${tx.length} transaction(s), recorded income is ${money(income)}, ` +
      `expenses are ${money(expenses)}, and net cash flow is ${money(balance)}. `;

    if (/afford|buy|purchase|laptop|spend/i.test(q) && amount) {
      answer += balance >= amount
        ? `Your recorded net cash flow currently covers ${money(amount)}. Check upcoming bills and emergency savings before buying.`
        : `Your recorded net cash flow does not currently cover ${money(amount)}. Consider saving toward it first.`;
    } else if (/save|saving/i.test(q)) {
      answer += `Your calculated savings rate is ${savingsRate.toFixed(1)}%. Review your largest expense categories and set a realistic savings target.`;
    } else if (/expense|spend/i.test(q)) {
      answer += categories.length
        ? `Your highest expense category is ${categories[0].name}, at ${money(categories[0].value)}.`
        : 'There are no expense entries yet.';
    } else {
      answer += 'Add transactions and ask me about affordability, expenses or savings.';
    }

    return answer + ' This is a budgeting estimate, not regulated financial advice.';
  }

  function askAI() {
    const q = question.trim();
    if (!q) return;

    setChat(old => [
      ...old,
      { role: 'user', text: q },
      { role: 'assistant', text: advisorAnswer(q) }
    ]);

    setQuestion('');
  }

  if (screen === 'landing') {
    return <Landing onEnter={enter} />;
  }

  if (screen === 'auth') {
    return (
      <AuthScreen
        mode={authMode}
        setMode={mode => {
          setAuthMode(mode);
          setAuthError('');
          setAuthNotice('');
        }}
        name={authName}
        setName={setAuthName}
        email={authEmail}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        error={authError}
        notice={authNotice}
        onSubmit={submitAuth}
        onHome={() => setScreen('landing')}
      />
    );
  }

  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <a
          className="brand"
          href="#home"
          onClick={e => {
            e.preventDefault();
            setScreen('landing');
          }}
        >
          <span className="brand-mark">M</span>
          <span>
            MAISON<span className="red">MONEY</span>
            <small>WEALTH, WITH INTENTION</small>
          </span>
        </a>

        <div className="nav-caption">YOUR WORKSPACE</div>

        <nav>
          {navItems.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-link ${page === name ? 'active' : ''}`}
              onClick={() => {
                setPage(name);
                setMobile(false);
              }}
            >
              <Icon size={17} />
              {name}
              {page === name && <i />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={17} />
            <b>Small choices. Stronger future.</b>
            <p>Your financial picture gets clearer with every real entry.</p>
          </div>

          <div className="profile">
            <span>
              {(read<Record<string, UserAccount>>('maison_v2_users', {})[activeUser]?.name || 'M')
                .charAt(0).toUpperCase()}
            </span>
            <div>
              <b>{read<Record<string, UserAccount>>('maison_v2_users', {})[activeUser]?.name || 'Maison Member'}</b>
              <small>{activeUser}</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-left">
            <button className="mobile-menu" onClick={() => setMobile(true)}>
              <Menu />
            </button>
            <div>
              <small className="overline">YOUR FINANCIAL SPACE</small>
              <h2>{page}</h2>
            </div>
          </div>

          <div className="top-actions">
            <div className="date-pill">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </div>

            <button className="primary" onClick={addTransaction}>
              <Plus size={16} /> Add transaction
            </button>

            <button
              type="button"
              className="text-action"
              onClick={logout}
              title="Log out"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </header>

        {page === 'Overview' && (
          <>
            <section className="hero">
              <div>
                <span className="eyebrow"><i /> YOUR WEALTH, IN FOCUS</span>
                <h1>Make your money<br /><em>work with intention.</em></h1>
                <p>A clear view of what comes in, what goes out, and what you're building.</p>
              </div>

              <div className="hero-art">
                <div className="orbit o1" />
                <div className="orbit o2" />
                <div className="coin">
                  <b>M</b>
                  <small>MAISON MONEY</small>
                </div>
                <div className="float-tag">
                  <Sparkles size={14} /> YOUR MONEY, YOUR PLAN
                </div>
              </div>
            </section>

            <section className="metrics">
              <Metric title="Net cash flow" value={money(balance)} note="Income minus expenses" icon={Wallet} />
              <Metric title="Total income" value={money(income)} note="Your recorded income" icon={TrendingUp} />
              <Metric title="Total expenses" value={money(expenses)} note="Your recorded expenses" icon={TrendingDown} />
              <Metric title="Savings rate" value={`${savingsRate.toFixed(1)}%`} note="Calculated from your entries" icon={PiggyBank} />
            </section>

            <section className="columns">
              <Panel title="CASH FLOW" heading="Income & expenses">
                <DataOrEmpty has={tx.length > 0} text="Add transactions to build your cash-flow history.">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={v => money(Number(v))} />
                      <Area dataKey="income" stroke="#d71920" fill="#d7192020" />
                      <Area dataKey="expenses" stroke="#77879a" fill="#77879a20" />
                    </AreaChart>
                  </ResponsiveContainer>
                </DataOrEmpty>
              </Panel>

              <Panel title="SPENDING CONTROL" heading="Monthly budget">
                {budget > 0 ? (
                  <>
                    <div className="budget-value">
                      {money(monthExpense)}
                      <small> spent of {money(budget)}</small>
                    </div>
                    <Progress value={monthlyBudgetPct} />
                    <div className="budget-foot">
                      <span>{monthlyBudgetPct.toFixed(0)}% used</span>
                      <b>{money(Math.max(0, budget - monthExpense))} remaining</b>
                    </div>
                    {monthExpense > budget && <p className="warning">Monthly budget exceeded.</p>}
                  </>
                ) : (
                  <Empty
                    title="Set your monthly limit"
                    text="Your budget starts when you choose a limit."
                    action={() => setPage('Budget Planner')}
                  />
                )}
              </Panel>
            </section>

            <section className="columns">
              <Panel title="SPENDING MIX" heading="Where it goes">
                <DataOrEmpty has={categories.length > 0} text="Your category breakdown will appear after you add expenses.">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82}>
                        {categories.map((c, i) => (
                          <Cell key={c.name} fill={colors[i % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => money(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>

                  {categories.slice(0, 5).map((c, i) => (
                    <div className="legend" key={c.name}>
                      <span>
                        <i style={{ background: colors[i % colors.length] }} />
                        {c.name}
                      </span>
                      <b>{money(c.value)}</b>
                    </div>
                  ))}
                </DataOrEmpty>
              </Panel>

              <Panel title="FINANCIAL HEALTH" heading="Your money pulse">
                <div className="health-score">
                  {healthScore === null ? '—' : healthScore}
                  <small>/100</small>
                </div>
                <p className="muted">
                  {healthScore === null
                    ? 'Add income and expense entries to calculate a score.'
                    : healthScore >= 75
                      ? 'Your recorded finances show encouraging signals.'
                      : 'There are a few areas worth reviewing.'}
                </p>
                <button className="text-action" onClick={() => setPage('Maison AI')}>
                  Explore your insights ↗
                </button>
              </Panel>
            </section>

            <Panel title="LATEST ACTIVITY" heading="Recent transactions">
              <TxList
                items={filtered.slice(0, 5)}
                onEdit={editTransaction}
                onDelete={id => setTx(old => old.filter(t => t.id !== id))}
              />
            </Panel>
          </>
        )}

        {page === 'Transactions' && (
          <section className="page">
            <PageIntro
              title="Every rupee, accounted for."
              text="Only transactions you enter are included in your totals."
              action={<button className="primary" onClick={addTransaction}><Plus size={16} /> Add transaction</button>}
            />

            <Panel title="YOUR ACTIVITY" heading="Transaction history">
              <div className="filters">
                <label>
                  <Search size={16} />
                  <input
                    placeholder="Search transactions..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </label>
                <select value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="all">All activity</option>
                  <option value="income">Income</option>
                  <option value="expense">Expenses</option>
                </select>
              </div>

              <TxList
                items={filtered}
                onEdit={editTransaction}
                onDelete={id => setTx(old => old.filter(t => t.id !== id))}
              />
            </Panel>
          </section>
        )}

        {page === 'Budget Planner' && (
          <section className="page">
            <PageIntro
              title="Give every rupee a purpose."
              text="Set a monthly spending limit and compare it with this month's recorded expenses."
            />
            <Panel title="SPENDING CONTROL" heading="Monthly budget">
              <Field label="Monthly budget amount (₹)">
                <input
                  type="number"
                  min="0"
                  value={budget || ''}
                  placeholder="Enter your budget"
                  onChange={e => setBudget(Math.max(0, Number(e.target.value)))}
                />
              </Field>

              <div className="budget-value">{money(monthExpense)}<small> spent this month</small></div>
              <Progress value={monthlyBudgetPct} />
              <div className="budget-foot">
                <span>{monthlyBudgetPct.toFixed(1)}% used</span>
                <b>{budget ? money(Math.max(0, budget - monthExpense)) + ' remaining' : 'No limit set'}</b>
              </div>
            </Panel>
          </section>
        )}

        {page === 'Savings Goals' && (
          <section className="page">
            <PageIntro
              title="Make room for what matters."
              text="Create real savings targets and record contributions."
              action={<button className="primary" onClick={() => setModal('goal')}><Plus size={16} /> New goal</button>}
            />

            {goals.length === 0 ? (
              <Empty
                title="Your first goal starts here"
                text="Create an emergency fund, trip or new laptop goal."
                action={() => setModal('goal')}
              />
            ) : (
              <div className="goal-grid">
                {goals.map(g => {
                  const p = Math.min(100, g.saved / g.target * 100);

                  return (
                    <article className="surface goal-card" key={g.id}>
                      <div className="goal-top">
                        <Target className="red" />
                        <button className="quiet" onClick={() => setGoals(old => old.filter(x => x.id !== g.id))}>
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <h3>{g.name}</h3>
                      <div className="budget-value">
                        {money(g.saved)} <small>of {money(g.target)}</small>
                      </div>

                      <Progress value={p} />

                      <div className="budget-foot">
                        <span>{money(Math.max(0, g.target - g.saved))} to go</span>
                        <b>{p.toFixed(0)}% complete</b>
                      </div>

                      <div className="goal-actions">
                        <button
                          onClick={() => setGoals(old =>
                            old.map(x =>
                              x.id === g.id
                                ? { ...x, saved: x.saved + 500 }
                                : x
                            )
                          )}
                        >
                          Add ₹500
                        </button>

                        <button
                          onClick={() => setGoals(old =>
                            old.map(x =>
                              x.id === g.id
                                ? { ...x, saved: x.saved + 1000 }
                                : x
                            )
                          )}
                        >
                          Add ₹1,000
                        </button>
                      </div>

                      {p >= 100 && (
                        <p className="milestone">
                          <Trophy size={14} /> Goal reached!
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {page === 'Challenges' && (
          <section className="page">
            <PageIntro
              title="Make saving a habit."
              text="Record only the amount you have actually saved."
            />

            <div className="goal-grid">
              {challenges.map(c => (
                <article className="surface goal-card" key={c.id}>
                  <div className="goal-top">
                    <Flame className="red" />
                    <span className="tag">SAVING CHALLENGE</span>
                  </div>

                  <h3>{c.title}</h3>
                  <p className="muted">{c.description}</p>
                  <p className="helper">{c.unit}</p>

                  {c.id === 'roundup' ? (
                    <>
                      <div className="budget-value">{money(roundUp)}</div>
                      <small className="muted">
                        Potential round-up amount. Not transferred automatically.
                      </small>
                    </>
                  ) : (
                    <>
                      <div className="budget-value">
                        {money(c.saved)} <small>of {money(c.target)}</small>
                      </div>
                      <Progress value={Math.min(100, c.saved / c.target * 100)} />

                      <div className="goal-actions">
                        <button
                          onClick={() => setChallengeData(old => ({
                            ...old,
                            [c.id]: Math.min(c.target, (old[c.id] || 0) + 100)
                          }))}
                        >
                          Record ₹100 saved
                        </button>

                        <button
                          onClick={() => setChallengeData(old => ({
                            ...old,
                            [c.id]: 0
                          }))}
                        >
                          <RotateCcw size={12} /> Reset
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {page === 'Dream Planner' && (
          <section className="page">
            <PageIntro
              title="Plan the purchase, not the regret."
              text="Estimate a monthly saving target before making a big purchase."
            />

            <Panel title="DREAM PURCHASE PLANNER" heading="What are you saving for?">
              <div className="form-grid">
                <Field label="Purchase name">
                  <input
                    value={dream.name}
                    placeholder="e.g. Gaming laptop"
                    onChange={e => setDream(d => ({ ...d, name: e.target.value }))}
                  />
                </Field>

                <Field label="Estimated price (₹)">
                  <input
                    type="number"
                    min="0"
                    value={dream.price || ''}
                    onChange={e => setDream(d => ({ ...d, price: Number(e.target.value) }))}
                  />
                </Field>

                <Field label="Months to save">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={dream.months}
                    onChange={e => setDream(d => ({
                      ...d,
                      months: Math.max(1, Number(e.target.value))
                    }))}
                  />
                </Field>
              </div>

              <div className="dream-result">
                <small>MONTHLY SAVING TARGET</small>
                <b>{money(dream.price / Math.max(1, dream.months))}</b>
                <p>
                  {dream.name
                    ? `Save this amount each month for ${dream.name}.`
                    : 'Enter a purchase and price to create your plan.'}
                </p>
              </div>
            </Panel>
          </section>
        )}

        {page === 'Analytics' && (
          <section className="page">
            <PageIntro
              title="See the story behind your money."
              text="All charts use your recorded transactions."
            />

            <div className="columns">
              <Panel title="MONTHLY PERFORMANCE" heading="Income vs expenditure">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={v => money(Number(v))} />
                    <Bar dataKey="income" fill="#d71920" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="expenses" fill="#8795a5" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="CATEGORY ANALYSIS" heading="Expense breakdown">
                <DataOrEmpty has={categories.length > 0} text="Add expenses to see category-wise spending.">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82}>
                        {categories.map((c, i) => (
                          <Cell key={c.name} fill={colors[i % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => money(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </DataOrEmpty>
              </Panel>
            </div>

            <div className="columns">
              <Panel title="SAVINGS TREND" heading="Monthly net savings">
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={v => money(Number(v))} />
                    <Line dataKey="saved" stroke="#d71920" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="YEARLY SUMMARY" heading="Current rolling 12 months">
                <Summary label="Recorded income" value={money(monthly.reduce((s, m) => s + m.income, 0))} />
                <Summary label="Recorded expenses" value={money(monthly.reduce((s, m) => s + m.expenses, 0))} />
                <Summary label="Net cash flow" value={money(monthly.reduce((s, m) => s + m.saved, 0))} />
                <Summary label="Savings goals total" value={money(goalsTotal)} />
              </Panel>
            </div>

            <Panel title="DAILY SPENDING HEATMAP" heading="Recorded expense activity">
              <Heatmap spendByDay={spendByDay} />
            </Panel>

            <Panel title="MONTH-TO-MONTH COMPARISON" heading="Compare the latest two months">
              <Comparison data={monthly.slice(-2)} />
            </Panel>

            <Panel title="FINANCIAL INDEPENDENCE ESTIMATE" heading="A simple 25× annual spending model">
              <p className="muted">Illustrative calculator, not an investment recommendation.</p>

              <div className="form-grid">
                {[
                  ['monthlySpend', 'Monthly expenses (₹)'],
                  ['invested', 'Current investments (₹)'],
                  ['monthlyInvestment', 'Monthly investment (₹)'],
                  ['returnRate', 'Assumed annual return (%)']
                ].map(([key, label]) => (
                  <Field label={label} key={key}>
                    <input
                      type="number"
                      min="0"
                      value={independence[key as keyof typeof independence]}
                      onChange={e => setIndependence(s => ({
                        ...s,
                        [key]: e.target.value
                      }))}
                    />
                  </Field>
                ))}
              </div>

              <div className="dream-result">
                <small>ESTIMATED FINANCIAL INDEPENDENCE TARGET</small>
                <b>{money(independenceTarget)}</b>
                <p>
                  {Number.isFinite(years) && years > 0
                    ? `Estimated time: ${years.toFixed(1)} years.`
                    : 'Enter a positive monthly investment and return assumption.'}
                </p>
              </div>
            </Panel>
          </section>
        )}

        {page === 'Maison AI' && (
          <section className="page ai-page">
            <div className="ai-icon"><BrainCircuit size={34} /></div>
            <small className="overline">MAISON INTELLIGENCE</small>
            <h1>Clarity before <em>every decision.</em></h1>
            <p>Ask about affordability, spending patterns and saving.</p>

            <div className="ai-grid">
              <Insight
                icon={HeartPulse}
                title="Financial health score"
                value={healthScore === null ? 'Not enough data' : `${healthScore}/100`}
                detail="Calculated from your recorded cash flow and budget."
              />
              <Insight
                icon={Activity}
                title="Next-month spending estimate"
                value={money(predicted)}
                detail="Average of months with recorded expenses."
              />
              <Insight
                icon={ShieldAlert}
                title="Unusual expense flags"
                value={String(unusual.length)}
                detail="Entries above 2.5 times your average expense."
              />
              <Insight
                icon={Lightbulb}
                title="Savings recommendation"
                value={income > 0 ? money(Math.max(0, balance) * 0.2) : 'Add income first'}
                detail="Suggested 20% of positive net cash flow."
              />
              <Insight
                icon={TrendingDown}
                title="Top spending category"
                value={categories[0]?.name || 'No data'}
                detail={categories[0] ? money(categories[0].value) : 'Add expenses first.'}
              />
              <Insight
                icon={Target}
                title="Goal progress"
                value={money(goalsTotal)}
                detail={`${goals.length} savings goal(s).`}
              />
            </div>

            {unusual.length > 0 && (
              <Panel title="REVIEW THESE ENTRIES" heading="Potentially unusual expenses">
                {unusual.map(t => (
                  <div className="legend" key={t.id}>
                    <span>{t.title} · {t.date}</span>
                    <b>{money(t.amount)}</b>
                  </div>
                ))}
              </Panel>
            )}

            <Panel title="ASK MAISON" heading="Your personal finance assistant">
              <div className="chat-box">
                {chat.length === 0
                  ? <p className="muted">Try: “Can I afford a ₹15,000 laptop?”</p>
                  : chat.map((m, i) => (
                    <div className={`chat-msg ${m.role}`} key={i}>
                      <b>{m.role === 'user' ? 'You' : 'Maison'}</b>
                      <p>{m.text}</p>
                    </div>
                  ))}
              </div>

              <div className="chat-input">
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && askAI()}
                  placeholder="Ask about your finances..."
                />
                <button className="primary" onClick={askAI}>
                  <Send size={16} /> Ask
                </button>
              </div>

              <p className="helper">
                This version uses local calculations, not a connected AI model.
              </p>
            </Panel>
          </section>
        )}

        <footer>
          MAISON MONEY <i>·</i> YOUR FINANCES, WITH INTENTION <i>·</i> PERSONAL WORKSPACE
        </footer>
      </main>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form
            className="modal"
            onSubmit={modal === 'tx'
              ? saveTransaction
              : saveGoal}
          >
            <button type="button" className="modal-close" onClick={() => setModal(null)}>
              <X />
            </button>

            <small className="overline">
              {modal === 'tx' ? 'MONEY MOVEMENT' : 'YOUR NEXT MILESTONE'}
            </small>

            <h2>
              {modal === 'tx'
                ? editing === null ? 'Add a transaction' : 'Edit transaction'
                : 'Create a savings goal'}
            </h2>

            {modal === 'tx' ? (
              <>
                <Field label="Description">
                  <input
                    required
                    value={form.title}
                    placeholder="e.g. Monthly salary"
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                </Field>

                <Field label="Amount">
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                  />
                </Field>

                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    {[
                      'Food', 'Shopping', 'Travel', 'Bills', 'Housing',
                      'Salary', 'Freelance', 'Investment', 'Health',
                      'Education', 'Entertainment', 'Other'
                    ].map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>

                <div className="form-grid">
                  <Field label="Type">
                    <select
                      value={form.type}
                      onChange={e => setForm({
                        ...form,
                        type: e.target.value as 'income' | 'expense'
                      })}
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </Field>

                  <Field label="Date">
                    <input
                      required
                      type="date"
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                    />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Goal name">
                  <input
                    required
                    value={goalForm.name}
                    onChange={e => setGoalForm({ ...goalForm, name: e.target.value })}
                    placeholder="e.g. Emergency fund"
                  />
                </Field>

                <Field label="Target amount">
                  <input
                    required
                    type="number"
                    min="1"
                    value={goalForm.target}
                    onChange={e => setGoalForm({ ...goalForm, target: e.target.value })}
                  />
                </Field>

                <Field label="Already saved">
                  <input
                    type="number"
                    min="0"
                    value={goalForm.saved}
                    onChange={e => setGoalForm({ ...goalForm, saved: e.target.value })}
                  />
                </Field>
              </>
            )}

            <button className="primary submit" type="submit">
              {modal === 'tx' ? 'Save transaction' : 'Create goal'}
              <ChevronRight size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// 3D EARTH
function RealisticEarth() {
  const [earthMap, normalMap, cloudMap] = useTexture([
    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
    'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
    'https://threejs.org/examples/textures/planets/earth_clouds_1024.png'
  ]);

  earthMap.colorSpace = THREE.SRGBColorSpace;
  cloudMap.colorSpace = THREE.SRGBColorSpace;

  const earth = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (earth.current) earth.current.rotation.y += delta * 0.055;
    if (clouds.current) clouds.current.rotation.y += delta * 0.072;
  });

  return (
    <group ref={earth} rotation={[0.12, -0.35, 0.08]}>
      <mesh>
        <sphereGeometry args={[1.28, 96, 96]} />
        <meshStandardMaterial
          map={earthMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.55, 0.55)}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      <mesh ref={clouds} scale={1.008}>
        <sphereGeometry args={[1.28, 96, 96]} />
        <meshPhongMaterial
          map={cloudMap}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={1.055}>
        <sphereGeometry args={[1.28, 64, 64]} />
        <meshBasicMaterial
          color="#6bbcff"
          transparent
          opacity={0.13}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function HeroScene() {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.025;
  });

  return (
    <group ref={group}>
      <group position={[0.25, 0.02, 0]}>
        <Suspense fallback={null}>
          <RealisticEarth />
        </Suspense>

        <mesh rotation={[0.55, 0.2, 0.25]}>
          <torusGeometry args={[1.48, 0.009, 8, 220]} />
          <meshBasicMaterial color="#e10600" transparent opacity={0.9} />
        </mesh>

        <mesh rotation={[-0.38, -0.72, 0.82]}>
          <torusGeometry args={[1.57, 0.007, 8, 220]} />
          <meshBasicMaterial color="#d8e0e8" transparent opacity={0.75} />
        </mesh>

        <pointLight position={[-2, 1.4, 2]} color="#e10600" intensity={1.1} />
      </group>
    </group>
  );
}

// LANDING PAGE
function Landing({
  onEnter
}: {
  onEnter: (mode: 'login' | 'signup') => void
}) {
  return (
    <div className="landing cinematic-landing" id="top">
      <header className="landing-nav">
        <a className="cinema-brand" href="#top">
          <span className="cinema-brand-main">
            MAISON<br />MONEY<span> 2.0</span>
          </span>
          <small>YOUR PERSONAL FINANCE COMPANION</small>
        </a>

        <nav>
          <a href="#top">Home</a>
          <a href="#features">Features</a>
          <a href="#features">AI</a>
          <a
            href="#features"
            onClick={e => {
              e.preventDefault();
              onEnter('login');
            }}
          >
            Dashboard
          </a>
        </nav>

        <div className="landing-nav-actions">
          <button className="login-link" onClick={() => onEnter('login')}>
            Login
          </button>
          <button className="primary" onClick={() => onEnter('signup')}>
            Get Started <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <section className="cinema-hero">
        <div className="cinema-copy">
          <div className="cinema-kicker">
            <i /> THE FUTURE OF PERSONAL WEALTH
          </div>

          <h1>MAISON<br />MONEY <em>2.0</em></h1>

          <p className="cinema-tagline">
            Track <b>•</b> Plan <b>•</b> Invest <b>•</b> Grow
          </p>

          <p className="cinema-description">
            Your personal finance companion. Take control of your money,
            understand every move, and build the future you imagine.
          </p>

          <div className="hero-actions">
            <button className="primary" onClick={() => onEnter('signup')}>
              Get Started <ChevronRight size={17} />
            </button>
            <a className="cinema-secondary" href="#features">
              Explore Features
            </a>
          </div>

          <div className="cinema-stats">
            <div><b>AI</b><small>FINANCIAL INSIGHTS</small></div>
            <div><b>360°</b><small>WEALTH OVERVIEW</small></div>
            <div><b>∞</b><small>ROOM TO GROW</small></div>
          </div>
        </div>

        <div className="cinema-stage">
          <div className="stage-glow" />
          <div className="stage-grid" />

          <div className="scene-canvas">
            <Canvas
              camera={{ position: [0, 0, 5.1], fov: 37 }}
              dpr={[1, 1.7]}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[4, 5, 5]} intensity={2.8} />
              <pointLight position={[-3, 1, 3]} intensity={2.2} color="#e10600" />
              <pointLight position={[2, -3, -2]} intensity={1.2} color="#c5d0dc" />
              <HeroScene />
            </Canvas>
          </div>

          <div className="scene-label label-invest">
            <TrendingUp size={16} />
            <span>INVEST<small>Grow with clarity</small></span>
          </div>

          <div className="scene-label label-save">
            <PiggyBank size={16} />
            <span>SAVE<small>Build your future</small></span>
          </div>

          <div className="scene-label label-track">
            <ChartNoAxesCombined size={16} />
            <span>TRACK<small>Know your numbers</small></span>
          </div>

          <div className="scene-label label-grow">
            <Target size={16} />
            <span>GROW<small>Reach your goals</small></span>
          </div>

          <div className="stage-platform"><span /><span /><span /></div>
        </div>

        <div className="mountain mountain-left" />
        <div className="mountain mountain-right" />
      </section>

      <section className="cinema-feature-strip" id="features">
        <article><span><BrainCircuit /></span><b>AI Finance Advisor</b><small>Smarter financial decisions</small></article>
        <article><span><Wallet /></span><b>Smart Budgets</b><small>Stay in control</small></article>
        <article><span><ChartNoAxesCombined /></span><b>Expense Insights</b><small>Understand your habits</small></article>
        <article><span><TrendingUp /></span><b>Investment Tracking</b><small>See your wealth grow</small></article>
        <article><span><Target /></span><b>Goal Planning</b><small>Make plans happen</small></article>
      </section>

      <footer className="landing-footer">
        MAISON MONEY 2.0 <i>·</i> TRACK <i>·</i> PLAN <i>·</i> INVEST <i>·</i> GROW
      </footer>
    </div>
  );
}

// AUTHENTICATION SCREEN
function AuthScreen({
  mode, setMode, name, setName, email, setEmail,
  password, setPassword, error, notice, onSubmit, onHome
}: {
  mode: 'login' | 'signup';
  setMode: (m: 'login' | 'signup') => void;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  error: string;
  notice: string;
  onSubmit: (e: React.FormEvent) => void;
  onHome: () => void;
}) {
  const field: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px 15px',
    borderRadius: 12,
    border: '1px solid #343a43',
    background: '#111419',
    color: '#f5f5f5',
    outline: 'none',
    fontSize: 15
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: 'radial-gradient(circle at 80% 20%,rgba(225,6,0,.2),transparent 32%),linear-gradient(135deg,#08090b,#17191e 65%,#090a0c)',
      color: '#f5f5f5',
      fontFamily: 'Inter,Arial,sans-serif'
    }}>
      <section style={{
        width: 'min(100%,440px)',
        padding: 36,
        border: '1px solid rgba(192,192,192,.22)',
        borderRadius: 24,
        background: 'rgba(20,22,27,.92)',
        boxShadow: '0 30px 100px rgba(0,0,0,.5)'
      }}>
        <button
          type="button"
          onClick={onHome}
          style={{
            background: 'none',
            border: 0,
            color: '#c0c0c0',
            cursor: 'pointer',
            marginBottom: 26
          }}
        >
          ← Back to Maison Money
        </button>

        <div style={{ fontFamily: 'Georgia,serif', fontSize: 27, letterSpacing: 1 }}>
          MAISON MONEY <span style={{ color: '#e10600', fontSize: 14 }}>2.0</span>
        </div>

        <p style={{ color: '#9da4ae', fontSize: 12, letterSpacing: 3, marginTop: 8 }}>
          YOUR PERSONAL FINANCE COMPANION
        </p>

        <h1 style={{
          fontFamily: 'Georgia,serif',
          fontWeight: 400,
          fontSize: 34,
          margin: '30px 0 8px'
        }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>

        <p style={{ color: '#aab0b9', marginBottom: 25 }}>
          {mode === 'signup'
            ? 'Start building a clearer picture of your money.'
            : 'Sign in to continue to your financial workspace.'}
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 15 }}>
          {mode === 'signup' && (
            <label style={{ display: 'grid', gap: 8, color: '#c0c0c0', fontSize: 13 }}>
              Full name
              <input
                style={field}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>
          )}

          <label style={{ display: 'grid', gap: 8, color: '#c0c0c0', fontSize: 13 }}>
            Email address
            <input
              style={field}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label style={{ display: 'grid', gap: 8, color: '#c0c0c0', fontSize: 13 }}>
            Password
            <input
              style={field}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>

          {error && <p style={{ color: '#ff7777', fontSize: 13, margin: 0 }}>{error}</p>}

          {notice && (
            <p role="status" style={{ color: '#8fd6a5', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              {notice}
            </p>
          )}

          <button
            className="primary"
            type="submit"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          >
            {mode === 'signup' ? 'Create account' : 'Login'}
            <ChevronRight size={17} />
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#aab0b9', fontSize: 14, marginTop: 24 }}>
          {mode === 'signup' ? 'Already have an account?' : 'New to Maison Money?'}
          {' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
            style={{
              border: 0,
              background: 'none',
              color: '#ff3333',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {mode === 'signup' ? 'Login' : 'Create account'}
          </button>
        </p>

        <small style={{ display: 'block', color: '#737b86', lineHeight: 1.5, marginTop: 20 }}>
          Demo authentication only. Do not use a real password.
        </small>
      </section>
    </main>
  );
}

// REUSABLE COMPONENTS
function Metric({
  title, value, note, icon: Icon
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ElementType;
}) {
  return (
    <article className="metric">
      <div><span>{title}</span><i><Icon size={18} /></i></div>
      <b>{value}</b>
      <small>{note}</small>
    </article>
  );
}

function Panel({
  title, heading, children
}: {
  title: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface panel">
      <div className="section-head">
        <div><small className="overline">{title}</small><h3>{heading}</h3></div>
      </div>
      {children}
    </section>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function Empty({
  title, text, action
}: {
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-icon"><Sparkles size={20} /></span>
      <b>{title}</b>
      <p>{text}</p>
      {action && <button className="text-action" onClick={action}>Get started ↗</button>}
    </div>
  );
}

function DataOrEmpty({
  has, text, children
}: {
  has: boolean;
  text: string;
  children: React.ReactNode;
}) {
  return has ? <>{children}</> : <Empty title="Waiting for your entries" text={text} />;
}

function TxList({
  items, onEdit, onDelete
}: {
  items: Tx[];
  onEdit: (t: Tx) => void;
  onDelete: (id: number) => void;
}) {
  if (!items.length) {
    return (
      <Empty
        title="No transactions yet"
        text="Your activity will appear here after you add your first real transaction."
      />
    );
  }

  return (
    <div className="tx-list">
      {items.map(t => (
        <div className="tx-row" key={t.id}>
          <i className={t.type}>
            {t.type === 'income'
              ? <ArrowDownLeft size={17} />
              : <ArrowUpRight size={17} />}
          </i>

          <div className="tx-name">
            <b>{t.title}</b>
            <small>{t.category} · {t.date}</small>
          </div>

          <strong className={t.type}>
            {t.type === 'income' ? '+' : '−'}{money(t.amount)}
          </strong>

          <div className="tx-actions">
            <button onClick={() => onEdit(t)} title="Edit"><Pencil size={14} /></button>
            <button
              onClick={() => {
                if (confirm('Delete this transaction?')) onDelete(t.id);
              }}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PageIntro({
  title, text, action
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <small className="overline">MAISON MONEY WORKSPACE</small>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}

function Field({
  label, children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="legend"><span>{label}</span><b>{value}</b></div>;
}

function Insight({
  icon: Icon, title, value, detail
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="surface insight">
      <Icon />
      <small>{title}</small>
      <b>{value}</b>
      <p>{detail}</p>
    </article>
  );
}

function Heatmap({ spendByDay }: { spendByDay: Map<string, number> }) {
  const days = Array.from({ length: 91 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (90 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, value: spendByDay.get(key) || 0 };
  });

  const max = Math.max(1, ...days.map(d => d.value));

  return (
    <div className="heatmap">
      {days.map(d => (
        <span
          key={d.key}
          title={`${d.key}: ${money(d.value)}`}
          style={{
            opacity: d.value ? 0.25 + 0.75 * d.value / max : 0.12,
            background: d.value ? '#d71920' : '#aab4c0'
          }}
        />
      ))}
    </div>
  );
}

function Comparison({
  data
}: {
  data: { month: string; income: number; expenses: number; saved: number }[];
}) {
  if (data.every(d => d.income === 0 && d.expenses === 0)) {
    return (
      <Empty
        title="Not enough history to compare"
        text="Enter transactions in different months to compare performance."
      />
    );
  }

  return (
    <div className="comparison">
      {data.map(d => (
        <div key={d.month}>
          <b>{d.month}</b>
          <span>Income <strong>{money(d.income)}</strong></span>
          <span>Expenses <strong>{money(d.expenses)}</strong></span>
          <span>Net <strong>{money(d.saved)}</strong></span>
        </div>
      ))}
    </div>
  );
}
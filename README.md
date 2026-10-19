# CARDDEAL AI — Product Review, Price Comparison & Bank Offer Chatbot

A powerful, light-themed conversational AI shopping assistant orchestrated using **LangGraph**, **LangChain**, **Google Gemini**, **FastAPI**, and **React**.

CardDeal AI not only recommends products based on current prices, but also computes the **actual discounted price according to your specific credit and debit cards**, allowing higher-tier products to qualify if bank offers bring them within your budget!

---

## 🌟 Key Architecture & Capabilities

### 1. Multi-Input Intent Categorization (LangChain & Gemini)
Accepts:
- **Single Product Name** (e.g. `iphone 15`, `macbook air`, `sony wh-1000xm5`):
  1. Searches **SerpApi Google Shopping API** for top 10 exact variants.
  2. Presents candidate cards in the chat, allowing the user to select one or refine the query.
  3. Takes the selected product's price, increases it by **10%** (`modified_price`).
  4. Searches Google via SerpApi: `top 10 [category] under [modified_price]`.
  5. Scrapes the top 5 articles with **BeautifulSoup** to extract heading tags (`h1, h2, h3, h4`).
  6. Uses Gemini to select top products based on frequency of repetition across the articles (5 within budget, 5 slightly above budget).
  7. Runs parallel SerpApi tasks to resolve **Amazon.in** and **Flipkart.com** product links.
  8. Runs **Amazon Scraper** and **Flipkart Scraper** to extract specs and live **Bank Offers**.
  9. Calculates the maximum card discount based on the user's selected cards.
  10. If an above-budget product drops within the budget after the card discount, it is retained; results are filtered and ranked 1st, 2nd, 3rd, etc.
  11. Stores all product embeddings in **Chroma Vector Store** for continuation of the chat.
- **Product Link** (e.g. Amazon or Flipkart URL):
  1. Directly scrapes the product title, specs, and base price using `amazon_scraper.py` or `flipkart_scraper.py`.
  2. Executes the 10% modified price search, article heading scraping, parallel store links, and card discount ranking.
- **Budget / Category Query** (e.g. `I want to buy smartphone under 30000`):
  1. Detects category and target budget.
  2. Searches Google articles for roundups, scrapes headings, and selects candidate products.
  3. Checks both standard budget and slightly higher range products to test card discount eligibility.
  4. Ranks the top 5 qualified products with live card discounts.
- **Conversational RAG Continuation**:
  - Grounded answers over the session's vector store for questions like *"Which one has the better camera?"* or *"What is the HDFC bank discount terms?"*.

---

## 💳 Bank Card Support

Users can select from popular Indian credit and debit cards:
- **HDFC Bank Credit & Debit Cards**
- **SBI Credit & Debit Cards**
- **ICICI Bank Credit & Debit Cards**
- **Flipkart Axis Bank Credit Card**
- **Amazon Pay ICICI Credit Card**
- **Axis Bank Credit Card**
- **OneCard Credit Card**
- **Kotak Mahindra Credit Card**

---

## 🛠️ Tech Stack & Services

- **Backend**: Python 3.12, FastAPI, Uvicorn
- **Orchestrator**: LangGraph `StateGraph` with `MemorySaver` checkpointer
- **LLM**: Google Gemini (`gemini-2.0-flash` / `gemini-1.5-flash`)
- **Shopping & Search**: SerpApi (`google_shopping` and `google` engines)
- **Scrapers**:
  - `backend/app/services/amazon_scraper.py` (BeautifulSoup Amazon India scraper)
  - `backend/app/services/flipkart_scraper.py` (BeautifulSoup Flipkart scraper)
  - `backend/app/services/article_scraper.py` (Article heading tag extractor)
- **Bank Offer Engine**: `backend/app/services/bank_offer_engine.py`
- **Vector Store**: ChromaDB + LangChain embeddings
- **Frontend**: React 19, Vite, Lucide Icons, Pure CSS Light Theme

---

## 🚀 How to Run

### 1. Launch Servers
- **Windows Command Prompt**:
  ```cmd
  start.bat
  ```
- **PowerShell**:
  ```powershell
  .\run.ps1
  ```

### 2. Configure Keys
Click **"Configure Keys"** in the top navigation bar to input:
- **Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/app/apikey))
- **SerpApi Key** (from [SerpApi.com](https://serpapi.com/manage-api-key))

Visit **http://localhost:5173** to chat!

# EasyKart

## Voice Shopping for Everyone

EasyKart is an accessibility-focused e-commerce frontend designed to make online shopping simpler through a voice-first experience. Instead of relying entirely on traditional search and navigation, the interface places a conversational shopping assistant at the center of the experience.

## Core Idea

**Speak → Understand → Discover → Add to Cart → Checkout**

The interface is designed around a simple shopping flow where users can communicate what they need, view relevant products, manage their cart, and request human assistance.

## Features

- Voice-first shopping interface
- Conversational shopping assistant UI
- Product discovery and filtering interface
- Product cards with pricing and ratings
- Shopping cart interface
- Quantity management
- Checkout flow
- Human assistance option
- Accessibility-focused layout
- Responsive web design

## Technology Stack

- **HTML5** — semantic page structure
- **CSS3** — layout, styling and responsive design
- **JavaScript** — frontend interactions
- **Figma** — UI/UX design and prototyping
- **Git & GitHub** — version control

## Project Structure

```text
EasyKart/
├── index.html
├── style.css
├── script.js
├── progress.md
├── README.md
└── images/
```

## Design

The current design contains three primary screens:

1. **Home** — voice-first shopping assistant
2. **Voice Results** — product results based on a shopping request
3. **Cart** — selected products and order summary

The design prioritizes readable typography, strong contrast, large controls, clear navigation and simple interaction patterns.

## Current Status

The frontend design and core page structure are under development.

Completed:
- Basic project structure
- Navigation
- Categories
- Product listing
- Cart Section
- Voice assistant UI
- Product card styling
- Figma prototype

The local demo supports category and keyword filtering, a persistent cart, quantity
updates, and a validated Help form saved to `data/help_requests.json`.
Voice uses browser speech recognition when supported; the assistant uses simple
keywords. Review Order is a demo without payment or order placement.

## Run and prepare for viva

Run `python3 server.py` from the project folder, then open
[EasyKart locally](http://127.0.0.1:8000). No additional Python packages are required.
Use this server for form submission; a static server cannot write the JSON file.

In VS Code you can also choose **Terminal → Run Task → Start EasyKart**.
Keep that terminal running and open **http://127.0.0.1:8000**.
The Live Server **Go Live** button opens port 5500, which only previews pages;
it rejects form POST requests with error 405. The Help page now explains this
before submission and provides a link to the working form.

See [VIVA.md](VIVA.md) for the requirement mapping, code terms, demonstration steps
and project limitations. Form data in `data/` is excluded from Git.

## Team

**Group 4**

- Harsh Uppal
- Ishan Singh
- Ishank Chauhan
- Om Sharma
- Divyam Kumar

## Project Objective

To create a simple and accessible shopping interface that reduces the complexity of conventional e-commerce navigation and demonstrates how voice-first interaction can make online shopping easier for a wider range of users.

## Academic Project

**Course Code:** CSE2022  
**Course:** Web Programming  
**Batch:** 2025, 3rd Semester  
**Academic Year:** 2026–27

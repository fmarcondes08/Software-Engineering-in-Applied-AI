# Neural Networks — Customer Tier Classification

## Classification

This project is a **supervised multi-class classification** solution. The goal is to automatically assign customers to one of three service tiers — **premium**, **medium**, or **basic** — based on their personal and demographic profile.

The context simulates a real-world business scenario where a company needs to segment its customer base to tailor product offers, pricing, or services. Instead of applying manual rules, a neural network learns the patterns that define each tier from labeled training examples and uses that knowledge to classify new, unseen customers.

---

## Problem

Given a customer's profile, the system must predict which tier they belong to:

| Tier | Description |
|---|---|
| `premium` | High income, no children, owns a vehicle |
| `medium` | Mid-range income, moderate profile |
| `basic` | Low income, has children, no vehicle |

Each customer is described by **10 numerical features**, since neural networks only understand numbers. Categorical data (color preference, city) is converted using **one-hot encoding**, and continuous data (age, income) is **min-max normalized** to the `[0, 1]` range.

### Input Features (10 dimensions)

| # | Feature | Type | Encoding |
|---|---|---|---|
| 0 | Age | Continuous | `(age - 25) / (40 - 25)` |
| 1 | Color: blue | Binary | one-hot |
| 2 | Color: red | Binary | one-hot |
| 3 | Color: green | Binary | one-hot |
| 4 | Location: São Paulo | Binary | one-hot |
| 5 | Location: Rio | Binary | one-hot |
| 6 | Location: Vila Velha | Binary | one-hot |
| 7 | Income | Continuous | `(income - 1500) / (15000 - 1500)` |
| 8 | Has child | Binary | `0 = no, 1 = yes` |
| 9 | Owns vehicle | Binary | `0 = no, 1 = yes` |

### Output (3 classes — one-hot encoded)

| Index | Class | Encoding |
|---|---|---|
| 0 | premium | `[1, 0, 0]` |
| 1 | medium | `[0, 1, 0]` |
| 2 | basic | `[0, 0, 1]` |

---

## Tech Used

| Technology | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | v22+ | Runtime environment |
| [TensorFlow.js (tfjs-node)](https://www.tensorflow.org/js) | 4.22 | Neural network training and inference |
| ES Modules (`import/export`) | — | Modern JavaScript module system |

---

## Model Architecture

The model is a **Sequential Neural Network** with two fully connected (Dense) layers:

```
Input (10 features)
        │
        ▼
┌─────────────────────────────┐
│  Dense Layer                │
│  Units:      100 neurons    │
│  Activation: ReLU           │
│  Input Shape: [10]          │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Dense Layer (Output)       │
│  Units:      3 neurons      │
│  Activation: Softmax        │
└─────────────────────────────┘
        │
        ▼
Output: [p_premium, p_medium, p_basic]
```

### Configuration

| Parameter | Value | Reason |
|---|---|---|
| Optimizer | `Adam` | Adaptive learning rate; efficient and reliable for small datasets |
| Loss | `categoricalCrossentropy` | Standard loss for multi-class classification |
| Metric | `accuracy` | Measures percentage of correct predictions |
| Epochs | `100` | Full passes over the training data |
| Shuffle | `true` | Avoids order-dependent pattern learning |

**ReLU** (Rectified Linear Unit) is used in the hidden layer as a non-linear filter: it passes positive activations through and zeroes out negative ones, allowing the network to learn complex patterns.

**Softmax** in the output layer converts raw scores into a probability distribution across the 3 classes, where all values sum to 1.

---

## How to Execute

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm

### Install dependencies

```bash
npm install
```

### Run

```bash
npm start
```

This runs the script with `--watch` mode, so any file change will automatically restart the process.

### Expected output

```
Epoch 0:  loss = 1.09, accuracy = 33.33%
Epoch 1:  loss = 1.07, accuracy = 40.00%
...
Epoch 99: loss = 0.21, accuracy = 100.00%
Predictions for person 11: premium: 85.12%
                            medium:  11.34%
                            basic:    3.54%
```

import tf from '@tensorflow/tfjs-node';

async function trainModel(inputXs, outputYs) {
    const model = tf.sequential();

    // First network layer
    // 10 input features (normalized age + 3 colors + 3 locations + normalized income + has_child + owns_vehicle)

    // 100 neurons = since we have a small training dataset
    // more neurons means more complexity the network can learn
    // and consequently, more processing power will be used

    // ReLU acts as a filter:
    // It's like saying: "If the information is relevant (greater than zero),
    // let it through. If not, block it."
    model.add(tf.layers.dense({ inputShape: [10], units: 100, activation: 'relu' }))

    // Output: 3 neurons (premium, medium, basic)
    // One for each category we want to predict

    // 'softmax' activation normalizes the output into probabilities
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }))

    // Compiling the model
    // optimizer Adam (Adaptive Moment Estimation)
    // is a modern personal trainer for neural networks
    // adjusts weights efficiently and intelligently
    // learns from history of errors and successes

    // loss: categoricalCrossentropy
    // It compares what the model "thinks" (the scores for each category)
    // with the correct answer
    // the premium category will always be [1, 0, 0]

    // the further the model's prediction from the correct answer
    // the greater the error (loss)
    // Classic example: image classification, recommendation, user categorization
    // anything where the correct answer is "just one among several possible"
    model.compile({optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] })

    // Model training
    await model.fit(inputXs, outputYs, 
        {
            verbose: 0, // Disables internal logging (uses only callback)
            epochs: 100, // How many times the model goes through the entire training dataset
            shuffle: true, // Shuffles data each epoch to prevent the model from learning order-specific patterns
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(
                        `Epoch ${epoch}: loss = ${logs.loss}, accuracy = ${(logs.acc * 100).toFixed(2)}%`)
                }
            }
        }
    )

    return model
}

async function predict(model, inputTensor) {
    // convert the JS array to a tensor (tfjs)
    const tfInput = tf.tensor2d(inputTensor)

    // Makes the prediction (output will be a probability vector for each category)
    const prediction = model.predict(tfInput)
    const predArray = await prediction.array()
    return predArray[0].map((prob, index) => {
        return { prob, index }
    })
}
// Example people for training (each person with age, color and location)
// const people = [
//     { name: "Person 1", age: 30, color: "blue",  location: "São Paulo" },
//     { name: "Person 2", age: 25, color: "red",   location: "Rio" },
//     { name: "Person 3", age: 40, color: "green", location: "Vila Velha" }
// ];

// Input vectors with already normalized and one-hot encoded values
// Order: [normalized_age, blue, red, green, São Paulo, Rio, Vila Velha,
// normalized_income, has_child, owns_vehicle]
// normalized income: (income - 1500) / (15000 - 1500)
// has_child:    0 = no, 1 = yes
// owns_vehicle: 0 = no, 1 = yes
// const peopleData = [
//     [0.33, 1, 0, 0, 1, 0, 0, 0.78, 0, 1], // person 1
//     [0,    0, 1, 0, 0, 1, 0, 0.33, 1, 1], // person 2
//     [1,    0, 0, 1, 0, 0, 1, 0.04, 1, 0]  // person 3
// ]

// We use only numerical data, as neural networks only understand numbers.
// normalizedPeopleData corresponds to the model's input dataset.
const normalizedPeopleData = [
    //  age    color        location           income child vehicle
    [0.33, 1, 0, 0, 1, 0, 0, 0.78, 0, 1], // person 1  - premium: high income, no child,  owns vehicle
    [0,    0, 1, 0, 0, 1, 0, 0.33, 1, 1], // person 2  - medium:  mid income,  has child, owns vehicle
    [1,    0, 0, 1, 0, 0, 1, 0.04, 1, 0], // person 3  - basic:   low income,  has child, no vehicle
    [0.67, 1, 0, 0, 1, 0, 0, 0.85, 0, 1], // person 4  - premium: high income, no child,  owns vehicle
    [0.13, 0, 1, 0, 0, 1, 0, 0.02, 1, 0], // person 5  - basic:   low income,  has child, no vehicle
    [0.87, 0, 0, 1, 0, 0, 1, 0.70, 0, 1], // person 6  - premium: high income, no child,  owns vehicle
    [0,    1, 0, 0, 0, 1, 0, 0.30, 0, 0], // person 7  - medium:  mid income,  no child,  no vehicle
    [1,    0, 1, 0, 1, 0, 0, 0.05, 1, 0], // person 8  - basic:   low income,  has child, no vehicle
    [0.47, 0, 0, 1, 1, 0, 0, 0.41, 1, 1], // person 9  - medium:  mid income,  has child, owns vehicle
    [0.27, 1, 0, 0, 0, 0, 1, 0.01, 1, 0], // person 10 - basic:   low income,  has child, no vehicle
]

// Category labels to be predicted (one-hot encoded)
// [premium, medium, basic]
const labelNames = ["premium", "medium", "basic"]; // Label order
const tensorLabels = [
    [1, 0, 0], // premium - person 1
    [0, 1, 0], // medium  - person 2
    [0, 0, 1], // basic   - person 3
    [1, 0, 0], // premium - person 4
    [0, 0, 1], // basic   - person 5
    [1, 0, 0], // premium - person 6
    [0, 1, 0], // medium  - person 7
    [0, 0, 1], // basic   - person 8
    [0, 1, 0], // medium  - person 9
    [0, 0, 1], // basic   - person 10
];

// We create input (xs) and output (ys) tensors to train the model
const inputXs = tf.tensor2d(normalizedPeopleData)
const outputYs = tf.tensor2d(tensorLabels)

// The more data, the better!
// this way the algorithm can better understand patterns and make more accurate predictions
const model = await trainModel(inputXs, outputYs)

const newPerson = { name: "person 11", age: 28, color: "green", location: "Curitiba" }

// Normalizing the new person's data
// Example: age_min = 25, age_max = 40, so (28 - 25) / (40 - 25) = 0.2
const newPersonTensor = [
    [
        (newPerson.age - 25) / (40 - 25), // normalized age
        1, // blue
        0, // red
        0, // green
        0, // São Paulo
        1, // Rio
        0, // Vila Velha
        0.26, // normalized income: (5000 - 1500) / (15000 - 1500)
        0, // has_child: no
        1  // owns_vehicle: yes
    ]
]

const predictions = await predict(model, newPersonTensor)
const results = predictions.sort((a, b) => b.prob - a.prob)
    .map(pred => `${labelNames[pred.index]}: ${(pred.prob * 100).toFixed(2)}%`)
    .join('\n')

console.log(`Predictions for ${newPerson.name}:`, results)


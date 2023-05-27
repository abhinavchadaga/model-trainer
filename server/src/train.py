from argparse import ArgumentParser
import time
import sys


import torch
from torch.utils.data import DataLoader, random_split
from torchvision import transforms, datasets
from torchvision.models import resnet50, ResNet50_Weights


def log(update):
    """
    Logs a message for the node server
    Flush is used to ensure that the message is printed immediately
    log the current time and the update message
    """
    sys.stdout.write(f"[LOG {time.strftime('%H:%M:%S')}] - {update}")
    sys.stdout.flush()


def load_data(path_to_dataset: str) -> dict:
    """
    Loads the dataset from the given path and returns the train, validation and test loaders
    For now assume the ImageFolder format for image classification
    """
    data_transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),  # Resize images to a fixed size
            transforms.ToTensor(),  # Convert images to tensors
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
            ),  # Normalize images
        ]
    )
    dataset = datasets.ImageFolder(root=path_to_dataset, transform=data_transform)
    train_set, val_set, test_set = random_split(dataset, [0.8, 0.1, 0.1])

    train_loader = DataLoader(train_set, batch_size=2, shuffle=True, num_workers=8)
    val_loader = DataLoader(val_set, batch_size=2, shuffle=True, num_workers=8)
    test_loader = DataLoader(test_set, batch_size=2, shuffle=True, num_workers=8)

    return {
        "classes": dataset.classes,
        "train": train_loader,
        "val": val_loader,
        "test": test_loader,
    }


def train(model, train_loader, val_loader, criterion, optimizer, num_epochs=10):
    """
    Perform single cost optimization on the model
    """
    log(f"Training model for {num_epochs} epochs")
    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        for i, data in enumerate(train_loader):
            inputs, labels = data
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
            log(
                f"iteration {(i + 1) * (epoch + 1)} of {(len(train_loader) * num_epochs)}"
            )
        log(f"Epoch {epoch + 1} - Training loss: {running_loss / len(train_loader)}")

        model.eval()
        running_loss = 0.0
        for i, data in enumerate(val_loader):
            inputs, labels = data
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            running_loss += loss.item()
        log(f"Epoch {epoch + 1} - Validation loss: {running_loss / len(val_loader)}")

    return model


def main():
    data = load_data("data/dataset/chess-dataset")
    # log("data loaded")

    # load the resnet50 model from torchvision
    # log("loading model")
    model = resnet50(weights=ResNet50_Weights.DEFAULT)
    # log("model loaded")

    # freeze the model parameters
    for param in model.parameters():
        param.requires_grad = False

    # replace the last layer with a new layer with a dimension equal to the number of classes
    num_classes = len(data["classes"])
    model.fc = torch.nn.Linear(model.fc.in_features, num_classes)

    # log the model architecture
    # log(model)
    trained_model = train(
        model,
        data["train"],
        data["val"],
        torch.nn.CrossEntropyLoss(),
        torch.optim.Adam(model.parameters(), lr=0.001),
    )


if __name__ == "__main__":
    # take one positional argument called "path_to_dataset"
    main()

import torch.nn as nn
import torch.nn.functional as F

class ResNet(nn.Module):
    """Residual network that supports an arbitrary number of input planes.

    Parameters
    ----------
    game : Game
        Concrete game implementation (Chess, Connect‑Four, …) – provides board
        dimensions and `action_size`.
    num_resBlocks : int
        Depth of the residual backbone.
    num_hidden : int
        Number of channels in all hidden convolutions.
    device : torch.device or str
        Target device ("cpu" or "cuda").  **Kept as the 4th positional argument
        so existing Connect‑Four / Tic‑Tac‑Toe code continues to work.**
    num_input_planes : int, optional
        Channels of the encoded board representation.  Defaults to **3** for the
        original games; pass `game.num_input_planes` (18) for Chess.
    """

    def __init__(self, game, num_resBlocks, num_hidden, device, num_input_planes: int = 3):
        super().__init__()
        self.device = device

        # ---------------------------------- #
        #            Architecture            #
        # ---------------------------------- #
        self.startBlock = nn.Sequential(
            nn.Conv2d(num_input_planes, num_hidden, kernel_size=3, padding=1),
            nn.BatchNorm2d(num_hidden),
            nn.ReLU(),
        )

        self.backBone = nn.ModuleList([ResBlock(num_hidden) for _ in range(num_resBlocks)])

        # Policy head – outputs `action_size` logits (one per legal move slot)
        self.policyHead = nn.Sequential(
            nn.Conv2d(num_hidden, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(32 * game.row_count * game.column_count, game.action_size),
        )

        # Value head – scalar in [-1,1]
        self.valueHead = nn.Sequential(
            nn.Conv2d(num_hidden, 3, kernel_size=3, padding=1),
            nn.BatchNorm2d(3),
            nn.ReLU(),
            nn.Flatten(),
            nn.Linear(3 * game.row_count * game.column_count, 1),
            nn.Tanh(),
        )

        self.to(device)

    # --------------------------- #
    #       forward pass         #
    # --------------------------- #
    def forward(self, x):
        x = self.startBlock(x)
        for resBlock in self.backBone:
            x = resBlock(x)
        policy = self.policyHead(x)
        value = self.valueHead(x)
        return policy, value


class ResBlock(nn.Module):
    """Standard 2‑layer residual block used by AlphaZero‑like models."""

    def __init__(self, num_hidden):
        super().__init__()
        self.conv1 = nn.Conv2d(num_hidden, num_hidden, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(num_hidden)
        self.conv2 = nn.Conv2d(num_hidden, num_hidden, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(num_hidden)

    def forward(self, x):
        residual = x
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.bn2(self.conv2(x))
        x += residual
        x = F.relu(x)
        return x

import torch
import torch.nn as nn
import torch.nn.functional as F

# ==========================================
# 1. AE_ANOWGAN - detekce anomálií
# ==========================================
# Residuální bloky
class ResBlockDown(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1)
        self.ln1 = nn.InstanceNorm2d(out_channels, affine=True) 
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.ln2 = nn.InstanceNorm2d(out_channels, affine=True)
        self.downsample = nn.AvgPool2d(2)
        
        self.shortcut = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=1),
            nn.AvgPool2d(2)
        )

    def forward(self, x):
        res = self.shortcut(x)
        x = F.leaky_relu(self.ln1(self.conv1(x)), 0.2)
        x = self.conv2(x)
        x = self.downsample(x)
        x = self.ln2(x)
        return x + res

class ResBlockUp(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.upsample = nn.Upsample(scale_factor=2, mode='nearest')
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(out_channels)
        
        self.shortcut = nn.Sequential(
            nn.Upsample(scale_factor=2, mode='nearest'),
            nn.Conv2d(in_channels, out_channels, kernel_size=1)
        )

    def forward(self, x):
        res = self.shortcut(x)
        x = self.upsample(x)
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.bn2(self.conv2(x))
        return x + res
# Modely
class Generator(nn.Module):
    def __init__(self, latent_dim=100):
        super().__init__()
        self.latent_dim = latent_dim
        self.init_size = 16 
        
        # Extrémně osekáno: startujeme jen na 32 kanálech
        self.l1 = nn.Linear(latent_dim, 32 * self.init_size ** 2)
        
        self.res_blocks = nn.Sequential(
            ResBlockUp(32, 16),
            ResBlockUp(16, 8),
            ResBlockUp(8, 4),
            ResBlockUp(4, 4)
        )
        self.final_conv = nn.Conv2d(4, 1, kernel_size=3, padding=1)

    def forward(self, z):
        out = self.l1(z)
        out = out.view(out.shape[0], 32, self.init_size, self.init_size)
        out = self.res_blocks(out)
        return torch.tanh(self.final_conv(out))

class Discriminator(nn.Module):
    def __init__(self):
        super().__init__()
        # Ztenčeno od samého začátku: začínáme na pouhých 4 kanálech
        self.init_conv = nn.Conv2d(1, 4, kernel_size=3, padding=1)
        
        self.res_blocks = nn.Sequential(
            ResBlockDown(4, 8),
            ResBlockDown(8, 16),
            ResBlockDown(16, 32),
            ResBlockDown(32, 32)
        )
        self.flatten = nn.Flatten()
        self.fc = nn.Linear(32 * 16 * 16, 1)

    def forward(self, img):
        out = F.leaky_relu(self.init_conv(img), 0.2)
        out = self.res_blocks(out)
        out = self.flatten(out)
        return self.fc(out)

    def extract_features(self, img):
        out = F.leaky_relu(self.init_conv(img), 0.2)
        out = self.res_blocks(out)
        return self.flatten(out)

class Encoder(nn.Module):
    def __init__(self, latent_dim=100):
        super().__init__()
        self.init_conv = nn.Conv2d(1, 4, kernel_size=3, padding=1)
        
        self.res_blocks = nn.Sequential(
            ResBlockDown(4, 8),
            ResBlockDown(8, 16),
            ResBlockDown(16, 32),
            ResBlockDown(32, 32)
        )
        self.flatten = nn.Flatten()
        self.fc = nn.Linear(32 * 16 * 16, latent_dim)

    def forward(self, img):
        out = F.leaky_relu(self.init_conv(img), 0.2)
        out = self.res_blocks(out)
        out = self.flatten(out)
        return torch.tanh(self.fc(out))
    
# ==========================================
# 2. 1D_CNN - klasifikace poruch
# ==========================================
class BearingFault1DCNN(nn.Module):
    def __init__(self, num_classes=10):
        super(BearingFault1DCNN, self).__init__()
        
        # První konvoluční vrstva (C1)
        # Vstupní kanály: 2 (amplituda a fáze), Výstupní kanály: 20 
        # Velikost kernelu: 16, Krok (stride): 4, Padding: žádný 
        self.conv1 = nn.Conv1d(in_channels=2, out_channels=20, kernel_size=16, stride=4, padding=0)
        self.relu1 = nn.ReLU() # Pro aktivaci se běžně používá ReLU [cite: 156]
        
        # Druhá konvoluční vrstva (C2)
        # Vstupní kanály: 20, Výstupní kanály: 50 
        # Velikost kernelu: 8, Krok (stride): 4, Padding: žádný 
        self.conv2 = nn.Conv1d(in_channels=20, out_channels=50, kernel_size=8, stride=4, padding=0)
        self.relu2 = nn.ReLU()
        
        # Pooling vrstva (P1)
        # Autoři použili adaptivní průměrovací pooling vrstvu [cite: 512, 515]
        self.pool = nn.AdaptiveAvgPool1d(1)
        
        # Plně propojená vrstva (FC)
        # Vstup: 50 prvků z pooling vrstvy, Výstup: 4 třídy (místo původních 10) 
        self.fc = nn.Linear(in_features=50, out_features=num_classes)

    def forward(self, x):
        # x má tvar (batch_size, 2_kanály, délka_signálu)
        x = self.conv1(x)
        x = self.relu1(x)
        
        x = self.conv2(x)
        x = self.relu2(x)
        
        x = self.pool(x)
        
        # Vyhlazení (flatten) tenzoru pro vstup do plně propojené vrstvy
        x = torch.flatten(x, 1)
        x = self.fc(x)
        
        # Softmax aplikovat nemusíme, pokud při tréninku použijeme nn.CrossEntropyLoss,
        # která si Softmax počítá sama uvnitř.
        return x
    
# ==========================================
# 3. Bi-LSTM - predikce RUL
# ==========================================
class BiLSTM_RUL(nn.Module):
    def __init__(self, input_size=14, hidden_size=64, num_layers=2, dropout=0.3):
        super(BiLSTM_RUL, self).__init__()
        
        # Obousměrná LSTM vrstva
        self.lstm = nn.LSTM(
            input_size=input_size, 
            hidden_size=hidden_size, 
            num_layers=num_layers, 
            batch_first=True, 
            dropout=dropout, 
            bidirectional=True
        )
        
        # Plně propojené vrstvy pro finální regresi
        # hidden_size * 2 kvůli obousměrnosti (forward + backward states)
        self.fc1 = nn.Linear(hidden_size * 2, 32)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(32, 1)

    def forward(self, x):
        # x má tvar: (batch_size, sequence_length, input_size)
        out, _ = self.lstm(x)
        
        # Zajímají nás pouze výstupy z posledního časového kroku v daném okně
        out = out[:, -1, :] 
        
        out = self.fc1(out)
        out = self.relu(out)
        out = self.fc2(out) # Výstupem je jediné číslo (RUL)
        return out
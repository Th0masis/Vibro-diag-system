import numpy as np
import warnings

# Potlačení varování při výpočtech (např. logaritmus nuly), ošetříme si to sami
warnings.filterwarnings('ignore')

class RULPredictor:
    def __init__(self, limit_threshold=10.0):
        """
        :param limit_threshold: Limit vibrací (ISO 10816), kdy je stroj KO.
        """
        self.limit = limit_threshold

    def predict_linear(self, history):
        """
        Model 1: Lineární regrese (y = mx + c)
        Vhodné pro: Počáteční fázi poruchy nebo pomalý nárůst.
        """
        # Potřebujeme aspoň 3 body
        if len(history) < 3:
            return None
            
        y = np.array(history)
        x = np.arange(len(y)) # Časová osa [0, 1, 2, ... n]
        
        try:
            # np.polyfit s parametrem 1 proloží přímku (lineární polynom)
            # m = sklon, c = posun
            m, c = np.polyfit(x, y, 1)
            
            # Pokud m <= 0, trend je klesající nebo rovný -> nekonečná životnost
            if m <= 0.0001:
                return None
                
            # Kdy dosáhneme limitu?  limit = m * x_cil + c
            x_target = (self.limit - c) / m
            
            # RUL = Cílový bod - Aktuální bod (poslední index)
            rul = x_target - (len(y) - 1)
            
            return max(0.0, float(rul))
            
        except Exception:
            return None

    def predict_exponential(self, history):
        """
        Model 2: Exponenciální regrese (y = a * exp(b * x))
        Vhodné pro: Pokročilou fázi, kdy se ložisko řítí do záhuby.
        """
        if len(history) < 3:
            return None
            
        y = np.array(history)
        x = np.arange(len(y))
        
        try:
            # Trik: Zlogaritmujeme Y a proložíme to přímkou.
            # ln(y) = ln(a) + b*x
            
            # Ošetření: Logaritmus nesmí dostat 0 nebo záporné číslo
            y_safe = np.where(y <= 0, 0.001, y)
            
            # Proložíme přímku zlogaritmovanými daty
            fit = np.polyfit(x, np.log(y_safe), 1)
            b = fit[0] # Rychlost růstu (exponent)
            log_a = fit[1] # Posun
            
            # Pokud b <= 0, neroste to exponenciálně
            if b <= 0.00001:
                return None
            
            # Výpočet cíle:
            # limit = a * exp(b * x)
            # ln(limit) = ln(a) + b * x
            # x = (ln(limit) - ln(a)) / b
            
            x_target = (np.log(self.limit) - log_a) / b
            rul = x_target - (len(y) - 1)
            
            return max(0.0, float(rul))
            
        except Exception:
            return None
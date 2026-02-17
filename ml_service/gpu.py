import tensorflow as tf
print("Verze TensorFlow:", tf.__version__)
gpus = tf.config.list_physical_devices('GPU')
print("Dostupné GPU:", gpus)
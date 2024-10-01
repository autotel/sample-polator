I had the idea that it would be nice being able to create a sampler which derives an infinite array of tones from few samples taken from different notes of an instrument. The idea was to do this, by separating the frequencies that don't vary when the tone varies, from the frequencies that do. Later on, it would be possible to implement some other vectors, such as non-linear tone variations, variations in velocity, et cetera. 

In this first, failed approach, I went for converting the samples into frequency domain. The idea would be that I could normalize the ft's in the range 0-1 and then multiply them across. This would, in theory lead me to an FT which emphasizes the permanent frequencies.

In order to obtain the frequencies that vary, I would do the same process, but I would also transpose the FT so that they all have their fundamental (most prominent) frequencies in alignment.

So far, I am not sure whether I haven't managed to normalize these FTs correctly, or that the procedure simply doesn't yield the results that I expected.

Perhaps viewing the modification history might be of interest as per the process. I did not include the audio files as to not bloat the repository